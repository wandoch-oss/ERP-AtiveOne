// Edge Function "buscar-notas": consulta a SEFAZ (NFeDistribuicaoDFe) e o ADN da NFS-e Nacional
// com o certificado A1 da empresa e guarda os XMLs em public.fiscal_docs.
// Passo a passo de implantação: FISCAL.md.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { envelopeDistDFe, envelopeEvento, ESPERA_MS, eventoManifestacao, lerRetDistDFe, lerRetEvento, lerRetNFSe, nsu15, soDigitos, URL_DISTDFE, URL_EVENTO, URL_NFSE, type Doc } from './fiscal.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const MAX_LOTES = 10; // 50 documentos por lote na SEFAZ

type Resultado = { novos: number; status: string; msg: string; aguardar_ate?: string };

function abrirCliente() {
  // certificado A1 em PEM (secrets da função) — nunca vai para o navegador
  const cert = Deno.env.get('CERT_PEM'), key = Deno.env.get('KEY_PEM'), ca = Deno.env.get('SEFAZ_CA_PEM');
  if (!cert || !key) return null;
  // deno-lint-ignore no-explicit-any
  const client = (Deno as any).createHttpClient({ cert, key, ...(ca ? { caCerts: [ca] } : {}) });
  return { cert, key, client };
}
const SEM_CERT = 'Certificado não configurado (secrets CERT_PEM e KEY_PEM). Veja FISCAL.md.';

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
      const c = abrirCliente();
      if (!c) return json({ erro: SEM_CERT }, 412);
      const { data: cfgs } = await db.from('fiscal_config').select('*').eq('ativo', true);
      const resumo: Record<string, unknown> = {};
      for (const cfg of cfgs ?? []) {
        for (const servico of ['nfe', 'nfse'] as const) {
          try {
            resumo[cfg.cnpj + ':' + servico] = await consultar(db, c.client, { org_id: cfg.org_id, cnpj: cfg.cnpj, servico, ambiente: cfg.ambiente, uf_codigo: cfg.uf_codigo });
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
    const c = abrirCliente();
    if (!c) return json({ erro: SEM_CERT }, 412);
    const { cert, key, client } = c;

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
      }
      return json({ ciencia: resultados });
    }

    const saida: Record<string, Resultado> = {};
    for (const servico of ['nfe', 'nfse'].filter((s) => servicos.includes(s))) {
      saida[servico] = await consultar(db, client, { org_id, cnpj, servico, ambiente, uf_codigo });
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
