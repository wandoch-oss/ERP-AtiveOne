import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { envelopeDistDFe, lerRetDistDFe, lerRetNFSe, chaveDoXml } from './fiscal.ts';

const chave = '5326' + '0'.repeat(40);
const xmlNfe = `<nfeProc><NFe><infNFe Id="NFe${chave}"></infNFe></NFe></nfeProc>`;
const b64 = (s) => gzipSync(Buffer.from(s)).toString('base64');

const env = envelopeDistDFe({ cnpj: '12.345.678/0001-95', ultNSU: '42', ambiente: 'producao', cUF: '53' });
assert.match(env, /<ultNSU>000000000000042<\/ultNSU>/);
assert.match(env, /<CNPJ>12345678000195<\/CNPJ>/);
assert.match(env, /<tpAmb>1<\/tpAmb>/);
assert.match(env, /<cUFAutor>53<\/cUFAutor>/);

const soap = `<soap:Envelope><soap:Body><nfeDistDFeInteresseResponse><nfeDistDFeInteresseResult><retDistDFeInt versao="1.01">
<tpAmb>1</tpAmb><cStat>138</cStat><xMotivo>Documento localizado</xMotivo><ultNSU>000000000000007</ultNSU><maxNSU>000000000000009</maxNSU>
<loteDistDFeInt><docZip NSU="000000000000007" schema="procNFe_v4.00.xsd">${b64(xmlNfe)}</docZip></loteDistDFeInt>
</retDistDFeInt></nfeDistDFeInteresseResult></nfeDistDFeInteresseResponse></soap:Body></soap:Envelope>`;
const r = await lerRetDistDFe(soap);
assert.equal(r.cStat, '138'); assert.equal(r.ultNSU, '000000000000007'); assert.equal(r.maxNSU, '000000000000009');
assert.equal(r.docs.length, 1); assert.equal(r.docs[0].xml, xmlNfe); assert.equal(r.docs[0].chave, chave);
assert.equal(r.docs[0].schema, 'procNFe_v4.00.xsd'); assert.equal(r.docs[0].nsu, '000000000000007');

const vazio = await lerRetDistDFe('<retDistDFeInt><cStat>137</cStat><xMotivo>Nenhum documento localizado</xMotivo><ultNSU>000000000000009</ultNSU><maxNSU>000000000000009</maxNSU></retDistDFeInt>');
assert.equal(vazio.cStat, '137'); assert.equal(vazio.docs.length, 0);
await assert.rejects(lerRetDistDFe('<html>erro</html>'));

const n = await lerRetNFSe(200, { LoteDFe: [{ NSU: 5, ChaveAcesso: 'X'.repeat(50), TipoDocumento: 'NFSE', ArquivoXml: b64('<NFSe/>') }] });
assert.equal(n.docs.length, 1); assert.equal(n.docs[0].xml, '<NFSe/>'); assert.equal(n.docs[0].nsu, '000000000000005');
assert.equal((await lerRetNFSe(404, { StatusProcessamento: 'NENHUM_DOCUMENTO_LOCALIZADO' })).vazio, true);
assert.equal(chaveDoXml('<x/>'), '');
console.log('fiscal.ts: ok');
