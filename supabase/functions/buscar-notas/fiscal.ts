// Funções puras da busca de notas (sem rede): montar pedidos e ler respostas da SEFAZ / ADN NFS-e.
// Testadas por fiscal.test.mjs (node --experimental-strip-types fiscal.test.mjs).

export const URL_DISTDFE = {
  producao: 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  homologacao: 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};
export const URL_NFSE = {
  producao: 'https://adn.nfse.gov.br',
  homologacao: 'https://adn.producaorestrita.nfse.gov.br',
};

export const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');
export const nsu15 = (v: unknown) => soDigitos(v).padStart(15, '0');

export function envelopeDistDFe(o: { cnpj: string; ultNSU: string; ambiente: string; cUF: string }) {
  const tpAmb = o.ambiente === 'homologacao' ? 2 : 1;
  return '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>' +
    '<nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg>' +
    '<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><tpAmb>' + tpAmb + '</tpAmb>' +
    '<cUFAutor>' + soDigitos(o.cUF) + '</cUFAutor><CNPJ>' + soDigitos(o.cnpj) + '</CNPJ>' +
    '<distNSU><ultNSU>' + nsu15(o.ultNSU) + '</ultNSU></distNSU></distDFeInt>' +
    '</nfeDadosMsg></nfeDistDFeInteresse></soap12:Body></soap12:Envelope>';
}

export type Doc = { nsu: string; schema: string; xml: string; chave: string };
export type RetDist = { cStat: string; xMotivo: string; ultNSU: string; maxNSU: string; docs: Doc[] };

const tag = (x: string, t: string) => (x.match(new RegExp('<' + t + '[^>]*>([^<]*)</' + t + '>')) || [])[1] || '';

export async function gunzipB64(b64: string): Promise<string> {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(ds).text();
}

export function chaveDoXml(xml: string): string {
  const m = xml.match(/Id="(?:NFe|NFS)?(\d{44,50})"/) || xml.match(/<chNFe>(\d{44})<\/chNFe>/);
  return m ? m[1] : '';
}

export async function lerRetDistDFe(soap: string): Promise<RetDist> {
  const ret = (soap.match(/<retDistDFeInt[\s\S]*?<\/retDistDFeInt>/) || [''])[0];
  if (!ret) throw new Error('Resposta da SEFAZ sem retDistDFeInt');
  const docs: Doc[] = [];
  const re = /<docZip\s+([^>]*)>([^<]+)<\/docZip>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ret))) {
    const nsu = (m[1].match(/NSU="(\d+)"/) || [])[1] || '';
    const schema = (m[1].match(/schema="([^"]+)"/) || [])[1] || '';
    const xml = await gunzipB64(m[2]);
    docs.push({ nsu: nsu15(nsu), schema, xml, chave: chaveDoXml(xml) });
  }
  return { cStat: tag(ret, 'cStat'), xMotivo: tag(ret, 'xMotivo'), ultNSU: tag(ret, 'ultNSU'), maxNSU: tag(ret, 'maxNSU'), docs };
}

// Lê o JSON do ADN (NFS-e Nacional). 404 = nenhum documento novo.
export async function lerRetNFSe(status: number, json: any): Promise<{ docs: Doc[]; vazio: boolean; msg: string }> {
  const lote = (json && (json.LoteDFe || json.loteDFe)) || [];
  const erros = ((json && (json.Erros || json.erros)) || []).map((e: any) => e.Descricao || e.descricao || e.Codigo || '').filter(Boolean);
  if (status === 404 || (!lote.length && !erros.length)) return { docs: [], vazio: true, msg: 'Nenhum documento novo' };
  if (!lote.length) return { docs: [], vazio: false, msg: erros.join('; ') || 'Erro ' + status };
  const docs: Doc[] = [];
  for (const d of lote) {
    const xml = d.ArquivoXml ? await gunzipB64(d.ArquivoXml) : '';
    docs.push({ nsu: nsu15(d.NSU), schema: d.TipoDocumento || 'NFSE', xml, chave: d.ChaveAcesso || chaveDoXml(xml) });
  }
  return { docs, vazio: false, msg: '' };
}

// Depois de 137 (nada novo) ou 656 (consumo indevido) a SEFAZ manda esperar ~1h antes de perguntar de novo.
export const ESPERA_MS = 61 * 60 * 1000;
