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

/* ---------- Ciência da operação (evento 210210) ---------- */
export const URL_EVENTO = {
  producao: 'https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
  homologacao: 'https://hom.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
};
const b64 = (u: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(u as ArrayBuffer)));
const pemCorpo = (pem: string, rotulo: string) => {
  const m = pem.match(new RegExp('-----BEGIN ' + rotulo + '-----([\\s\\S]*?)-----END ' + rotulo + '-----'));
  return m ? m[1].replace(/\s/g, '') : '';
};
export const dhBrasilia = (d = new Date()) =>
  new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 19) + '-03:00';

// O XML é montado já na forma canônica (C14N 1.0): sem espaços entre tags, atributos em ordem
// e tags vazias abertas/fechadas — assim o resumo assinado coincide com o que a SEFAZ recalcula.
export async function eventoCienciaAssinado(o: { cnpj: string; chave: string; ambiente: string; certPem: string; keyPem: string; agora?: Date }) {
  const id = 'ID210210' + o.chave + '01', NS = 'http://www.portalfiscal.inf.br/nfe';
  const corpo = '<cOrgao>91</cOrgao><tpAmb>' + (o.ambiente === 'homologacao' ? 2 : 1) + '</tpAmb><CNPJ>' + soDigitos(o.cnpj) +
    '</CNPJ><chNFe>' + o.chave + '</chNFe><dhEvento>' + dhBrasilia(o.agora) + '</dhEvento><tpEvento>210210</tpEvento>' +
    '<nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Ciencia da Operacao</descEvento></detEvento>';
  const infCanon = '<infEvento xmlns="' + NS + '" Id="' + id + '">' + corpo + '</infEvento>';
  const sha1 = async (s: string) => b64(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s)));
  const digest = await sha1(infCanon);
  const signedInfo = '<SignedInfo><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>' +
    '<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod><Reference URI="#' + id + '"><Transforms>' +
    '<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform>' +
    '<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform></Transforms>' +
    '<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod><DigestValue>' + digest + '</DigestValue></Reference></SignedInfo>';
  const DS = 'http://www.w3.org/2000/09/xmldsig#';
  const signedInfoCanon = signedInfo.replace('<SignedInfo>', '<SignedInfo xmlns="' + DS + '">');
  const pk = pemCorpo(o.keyPem, 'PRIVATE KEY');
  if (!pk) throw new Error('KEY_PEM precisa estar em PKCS#8 ("BEGIN PRIVATE KEY"). Gere com: openssl pkcs12 ... -nocerts -nodes');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pk), (c) => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' }, false, ['sign']);
  const sig = b64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signedInfoCanon)));
  const x509 = pemCorpo(o.certPem, 'CERTIFICATE');
  const assinatura = '<Signature xmlns="' + DS + '">' + signedInfo + '<SignatureValue>' + sig + '</SignatureValue>' +
    '<KeyInfo><X509Data><X509Certificate>' + x509 + '</X509Certificate></X509Data></KeyInfo></Signature>';
  const evento = '<evento versao="1.00"><infEvento Id="' + id + '">' + corpo + '</infEvento>' + assinatura + '</evento>';
  return { evento, infCanon, signedInfoCanon, digest, sig };
}

export function envelopeEvento(eventoXml: string, idLote: string) {
  return '<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>' +
    '<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4"><envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">' +
    '<idLote>' + idLote + '</idLote>' + eventoXml + '</envEvento></nfeDadosMsg></soap12:Body></soap12:Envelope>';
}

// 135/136 = evento registrado; 573 = já havia ciência (duplicidade) — ambos servem
export function lerRetEvento(soap: string) {
  const ret = (soap.match(/<retEnvEvento[\s\S]*?<\/retEnvEvento>/) || [''])[0];
  if (!ret) throw new Error('Resposta da SEFAZ sem retEnvEvento');
  const inf = (ret.match(/<infEvento[\s\S]*?<\/infEvento>/) || [ret])[0];
  const cStat = tag(inf, 'cStat'), ok = ['135', '136', '573'].includes(cStat);
  return { cStat, xMotivo: tag(inf, 'xMotivo'), ok, loteStat: tag(ret.replace(inf, ''), 'cStat') };
}
