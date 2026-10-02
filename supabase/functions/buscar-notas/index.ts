// Edge Function "buscar-notas": consulta a SEFAZ (NFeDistribuicaoDFe) e o ADN da NFS-e Nacional
// com o certificado A1 da empresa e guarda os XMLs em public.fiscal_docs.
// Passo a passo de implantação: FISCAL.md.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import forge from 'npm:node-forge@1';
import { cifrar, decifrar, lerPfx } from './cofre.ts';
import { envelopeDistDFe, envelopeEvento, ESPERA_MS, eventoManifestacao, lerRetDistDFe, lerRetEvento, lerRetNFSe, nsu15, soDigitos, URL_DISTDFE, URL_EVENTO, URL_NFSE, type Doc } from './fiscal.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const MAX_LOTES = 10; // 50 documentos por lote na SEFAZ

type Resultado = { novos: number; status: string; msg: string; aguardar_ate?: string };

// deno-lint-ignore no-explicit-any
type Db = any;
type Cred = { cert: string; key: string };
const SEM_CERT = 'Nenhum certificado digital para este CNPJ. Envie o .pfx em Cadastros → Empresas → Certificado digital.';

// 1º o certificado enviado pelo cadastro da empresa (cifrado no banco); 2º os secrets da função (CERT_PEM/KEY_PEM)
async function credenciais(db: Db, org_id: string, cnpj: string): Promise<Cred | null> {
  const segredo = Deno.env.get('CERT_KEY');
  if (segredo) {
    const { data } = await db.from('fiscal_cert_segredo').select('cert_enc,key_enc').match({ org_id, cnpj }).maybeSingle();
    if (data) return { cert: await decifrar(segredo, data.cert_enc), key: await decifrar(segredo, data.key_enc) };
  }
  const cert = Deno.env.get('CERT_PEM'), key = Deno.env.get('KEY_PEM');
  return cert && key ? { cert, key } : null;
}
function abrirCliente(c: Cred) {
  const ca = Deno.env.get('SEFAZ_CA_PEM');
  // deno-lint-ignore no-explicit-any
  return (Deno as any).createHttpClient({ cert: c.cert, key: c.key, ...(ca ? { caCerts: [ca] } : {}) });
}
async function registrar(db: Db, l: { org_id: string; cnpj: string; servico?: string; acao: string; status?: string; mensagem?: string; novos?: number; origem: string }) {
  try { await db.from('fiscal_log').insert({ ...l, mensagem: String(l.mensagem ?? '').slice(0, 500) }) } catch (_) { /* o histórico nunca derruba a consulta */ }
}
async function consultarLog(db: Db, client: unknown, o: Parameters<typeof consultar>[2], origem: string) {
  try {
    const r = await consultar(db, client, o);
    await registrar(db, { org_id: o.org_id, cnpj: o.cnpj, servico: o.servico, acao: 'buscar', status: r.status, mensagem: r.msg, novos: r.novos, origem });
    return r;
  } catch (e) {
    await registrar(db, { org_id: o.org_id, cnpj: o.cnpj, servico: o.servico, acao: 'buscar', status: 'erro', mensagem: (e as Error).message, novos: 0, origem });
    throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const corpo = await req.json();

    // Execução agendada (pg_cron): autenticada por segredo próprio; consulta tudo que estiver ativo em fiscal_config
    if (corpo.acao === 'agendada') {
      const segredo = Deno.env.get('CRON_SECRET');
      if (!segredo || req.headers.get('x-cron-secret') !== segredo) return json({ erro: 'Não autorizado.' }, 401);
      const { data: cfgs } = await db.from('fiscal_config').select('*').eq('ativo', true);
      const resumo: Record<string, unknown> = {};
      for (const cfg of cfgs ?? []) {
        let cred: Cred | null = null;
        try { cred = await credenciais(db, cfg.org_id, cfg.cnpj) } catch (e) { resumo[cfg.cnpj] = { erro: (e as Error).message } }
        if (!cred) {
          if (!resumo[cfg.cnpj]) resumo[cfg.cnpj] = { erro: SEM_CERT };
          await registrar(db, { org_id: cfg.org_id, cnpj: cfg.cnpj, acao: 'buscar', status: 'erro', mensagem: String((resumo[cfg.cnpj] as { erro: string }).erro), origem: 'agendada' });
          continue;
        }
        const client = abrirCliente(cred);
        for (const servico of ['nfe', 'nfse'] as const) {
          try {
            resumo[cfg.cnpj + ':' + servico] = await consultarLog(db, client, { org_id: cfg.org_id, cnpj: cfg.cnpj, servico, ambiente: cfg.ambiente, uf_codigo: cfg.uf_codigo }, 'agendada');
          } catch (e) { resumo[cfg.cnpj + ':' + servico] = { erro: (e as Error).message } }
        }
      }
      return json(resumo);
    }

    const { org_id, cnpj: cnpjRaw, servicos = ['nfe', 'nfse'], ambiente = 'producao', uf_codigo = '', acao = 'buscar', chaves = [], tipo = 'ciencia', justificativa = '' } = corpo;
    const cnpj = soDigitos(cnpjRaw);
    if (!org_id || cnpj.length !== 14) return json({ erro: 'Informe org_id e um CNPJ de 14 dígitos.' }, 400);

    // quem chamou precisa estar logado e ser membro da empresa
    const doUsuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: ehMembro, error: eAuth } = await doUsuario.rpc('eh_membro', { p_org: org_id });
    if (eAuth || !ehMembro) return json({ erro: 'Sem acesso a esta empresa.' }, 403);

    if (acao === 'certificado_enviar' || acao === 'certificado_remover') {
      const { data: ehAdm } = await doUsuario.rpc('eh_admin', { p_org: org_id });
      if (!ehAdm) return json({ erro: 'Só o administrador pode enviar ou remover o certificado.' }, 403);
      if (acao === 'certificado_remover') {
        await db.from('fiscal_cert_segredo').delete().match({ org_id, cnpj });
        await db.from('fiscal_cert_info').delete().match({ org_id, cnpj });
        await registrar(db, { org_id, cnpj, acao: 'certificado', status: 'removido', mensagem: 'Certificado removido', origem: 'manual' });
        return json({ ok: true });
      }
      const segredo = Deno.env.get('CERT_KEY');
      if (!segredo || segredo.length < 16) return json({ erro: 'Defina o secret CERT_KEY (frase longa, 16+ caracteres) na função antes de enviar o certificado. Veja FISCAL.md.' }, 412);
      const info = lerPfx(forge, String(corpo.pfx_b64 || ''), String(corpo.senha ?? ''));
      if (new Date(info.validade + 'T23:59:59-03:00') < new Date()) return json({ erro: 'Este certificado está vencido (' + info.validade + ').' }, 400);
      if (info.cnpjCert && info.cnpjCert.slice(0, 8) !== cnpj.slice(0, 8)) {
        return json({ erro: 'O certificado é do CNPJ ' + info.cnpjCert + ', diferente do CNPJ desta empresa (' + cnpj + ').' }, 400);
      }
      const { data: u } = await doUsuario.auth.getUser();
      const e1 = await db.from('fiscal_cert_segredo').upsert({ org_id, cnpj, cert_enc: await cifrar(segredo, info.certPem), key_enc: await cifrar(segredo, info.keyPem) });
      if (e1.error) return json({ erro: 'Não foi possível guardar: ' + e1.error.message }, 500);
      const meta = { org_id, cnpj, titular: info.titular, cnpj_cert: info.cnpjCert, validade: info.validade, fingerprint: info.fingerprint, enviado_em: new Date().toISOString(), enviado_por: u?.user?.id ?? null };
      await db.from('fiscal_cert_info').upsert(meta);
      await registrar(db, { org_id, cnpj, acao: 'certificado', status: 'enviado', mensagem: 'Certificado de ' + info.titular + ' válido até ' + info.validade, origem: 'manual' });
      return json({ ok: true, info: { titular: info.titular, cnpj_cert: info.cnpjCert, validade: info.validade, fingerprint: info.fingerprint, enviado_em: meta.enviado_em } });
    }

    const cred = await credenciais(db, org_id, cnpj);
    if (!cred) return json({ erro: SEM_CERT }, 412);
    const cert = cred.cert, key = cred.key, client = abrirCliente(cred);

    if (acao === 'ciencia' || acao === 'manifestar') {
      const tp = acao === 'ciencia' ? 'ciencia' : tipo;
      const lista = (chaves as string[]).map(soDigitos).filter((x) => x.length === 44).slice(0, 20);
      if (!lista.length) return json({ erro: 'Nenhuma chave de 44 dígitos informada.' }, 400);
      const resultados: Record<string, { ok: boolean; cStat: string; msg: string }> = {};
      for (const chave of lista) { // um evento por pedido: o erro de uma nota não derruba as outras
        try {
          const ev = await eventoManifestacao({ cnpj, chave, ambiente, certPem: cert, keyPem: key, tipo: tp, justificativa });
          const r = await fetch(URL_EVENTO[ambiente === 'homologacao' ? 'homologacao' : 'producao'], {
            method: 'POST', client,
            headers: { 'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento"' },
            body: envelopeEvento(ev.evento, '1'),
            // deno-lint-ignore no-explicit-any
          } as any);
          const ret = lerRetEvento(await r.text());
          resultados[chave] = { ok: ret.ok, cStat: ret.cStat, msg: ret.xMotivo };
        } catch (e) { resultados[chave] = { ok: false, cStat: '', msg: (e as Error).message } }
        await registrar(db, { org_id, cnpj, servico: 'nfe', acao: tp, status: resultados[chave].cStat || 'erro', mensagem: '…' + chave.slice(-8) + ' · ' + resultados[chave].msg, origem: 'manual' });
      }
      return json({ ciencia: resultados });
    }

    const saida: Record<string, Resultado> = {};
    for (const servico of ['nfe', 'nfse'].filter((s) => servicos.includes(s))) {
      saida[servico] = await consultarLog(db, client, { org_id, cnpj, servico, ambiente, uf_codigo }, 'manual');
    }
    return json(saida);
  } catch (e) {
    return json({ erro: (e as Error).message || String(e) }, 500);
  }
});

async function consultar(
  // deno-lint-ignore no-explicit-any
  db: any, client: unknown,
  o: { org_id: string; cnpj: string; servico: 'nfe' | 'nfse'; ambiente: string; uf_codigo: string },
): Promise<Resultado> {
  const chave = { org_id: o.org_id, cnpj: o.cnpj, servico: o.servico };
  const { data: cur } = await db.from('fiscal_cursor').select('*').match(chave).maybeSingle();
  if (cur?.proxima_consulta && new Date(cur.proxima_consulta) > new Date()) {
    return { novos: 0, status: 'aguardar', msg: 'A Receita pede um intervalo entre consultas.', aguardar_ate: cur.proxima_consulta };
  }
  let ult = nsu15(cur?.ult_nsu || '0'), max = ult, novos = 0, status = '', msg = '', espera = false;

  for (let i = 0; i < MAX_LOTES; i++) {
    let docs: Doc[] = [], vazio = false;
    if (o.servico === 'nfe') {
      if (!o.uf_codigo) return { novos, status: 'erro', msg: 'Informe a UF da empresa (código IBGE).' };
      const r = await fetch(URL_DISTDFE[o.ambiente === 'homologacao' ? 'homologacao' : 'producao'], {
        method: 'POST', client,
        headers: { 'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"' },
        body: envelopeDistDFe({ cnpj: o.cnpj, ultNSU: ult, ambiente: o.ambiente, cUF: o.uf_codigo }),
        // deno-lint-ignore no-explicit-any
      } as any);
      const ret = await lerRetDistDFe(await r.text());
      status = ret.cStat; msg = ret.xMotivo; docs = ret.docs;
      if (ret.ultNSU) ult = nsu15(ret.ultNSU);
      if (ret.maxNSU) max = nsu15(ret.maxNSU);
      if (ret.cStat === '137' || ret.cStat === '656') { espera = true; vazio = true }
      else if (ret.cStat !== '138') { vazio = true } // outro código: mostra a mensagem e para
    } else {
      const base = URL_NFSE[o.ambiente === 'homologacao' ? 'homologacao' : 'producao'];
      const r = await fetch(`${base}/contribuintes/DFe/${Number(ult) + 1}?cnpjConsulta=${o.cnpj}&lote=true`, {
        client, headers: { Accept: 'application/json' },
        // deno-lint-ignore no-explicit-any
      } as any);
      const txt = await r.text();
      let j = null; try { j = JSON.parse(txt) } catch (_) { /* resposta não-JSON */ }
      const ret = await lerRetNFSe(r.status, j);
      docs = ret.docs; vazio = ret.vazio; msg = ret.msg; status = String(r.status);
      if (docs.length) { ult = docs[docs.length - 1].nsu; max = ult }
      if (ret.vazio) espera = true;
      else if (!docs.length) vazio = true;
    }
    if (docs.length) {
      const linhas = docs.map((d) => ({
        org_id: o.org_id, cnpj: o.cnpj, servico: o.servico, nsu: d.nsu, chave: d.chave, tipo: d.schema, xml: d.xml,
      }));
      const { error } = await db.from('fiscal_docs').upsert(linhas, { onConflict: 'org_id,cnpj,servico,nsu', ignoreDuplicates: true });
      if (error) throw new Error('Não foi possível guardar as notas: ' + error.message);
      novos += docs.length;
      // o cursor só avança depois de guardar os documentos
      await db.from('fiscal_cursor').upsert({ ...chave, ult_nsu: ult, max_nsu: max, ultimo_status: status + ' ' + msg, consultado_em: new Date().toISOString() });
    }
    if (vazio || ult >= max) break;
  }
  const proxima = espera ? new Date(Date.now() + ESPERA_MS).toISOString() : null;
  await db.from('fiscal_cursor').upsert({
    ...chave, ult_nsu: ult, max_nsu: max, ultimo_status: status + ' ' + msg,
    consultado_em: new Date().toISOString(), proxima_consulta: proxima,
  });
  return { novos, status, msg, ...(proxima ? { aguardar_ate: proxima } : {}) };
}
