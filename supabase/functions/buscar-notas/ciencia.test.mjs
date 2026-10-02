import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { createVerify, createHash, X509Certificate } from 'node:crypto';
import { writeFileSync, readFileSync } from 'node:fs';
import { eventoCienciaAssinado, envelopeEvento, lerRetEvento } from './fiscal.ts';

const d = execSync('mktemp -d').toString().trim();
execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${d}/k.pem -out ${d}/c.pem -days 2 -subj "/CN=teste" 2>/dev/null`);
const certPem = readFileSync(d + '/c.pem', 'utf8'), keyPem = readFileSync(d + '/k.pem', 'utf8');
const chave = '5326' + '1'.repeat(40);
const r = await eventoCienciaAssinado({ cnpj: '12.345.678/0001-95', chave, ambiente: 'producao', certPem, keyPem, agora: new Date('2026-10-02T13:00:00Z') });

assert.match(r.evento, /dhEvento>2026-10-02T10:00:00-03:00</);
assert.equal(createHash('sha1').update(r.infCanon).digest('base64'), r.digest);
assert.ok(createVerify('RSA-SHA1').update(r.signedInfoCanon).verify(new X509Certificate(certPem).publicKey, r.sig, 'base64'));

// confere que a forma "canônica" escrita à mão é mesmo C14N 1.0 (se o xmllint existir)
try {
  const doc = `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>1</idLote>${r.evento}</envEvento>`;
  writeFileSync(d + '/e.xml', doc);
  const c14n = execSync(`xmllint --c14n ${d}/e.xml`).toString();
  // no documento inteiro o xmlns herdado não se repete; na subárvore assinada ele aparece
  const semNs = (x, ns) => x.replace(' xmlns="' + ns + '"', '');
  assert.ok(c14n.includes(semNs(r.infCanon, 'http://www.portalfiscal.inf.br/nfe')), 'infEvento canônico difere do C14N real');
  const si = c14n.match(/<SignedInfo[\s\S]*?<\/SignedInfo>/)[0];
  assert.equal(si, semNs(r.signedInfoCanon, 'http://www.w3.org/2000/09/xmldsig#'), 'SignedInfo canônico difere do C14N real');
  console.log('C14N conferido com xmllint');
} catch (e) { if (e.code === 'ERR_ASSERTION') throw e; console.log('xmllint indisponível — C14N não conferido'); }

assert.match(envelopeEvento(r.evento, '1'), /<idLote>1<\/idLote><evento/);
const ret = (cs) => `<retEnvEvento><idLote>1</idLote><cStat>128</cStat><xMotivo>Lote processado</xMotivo><retEvento><infEvento><cStat>${cs}</cStat><xMotivo>x</xMotivo></infEvento></retEvento></retEnvEvento>`;
assert.equal(lerRetEvento(ret('135')).ok, true); assert.equal(lerRetEvento(ret('573')).ok, true); assert.equal(lerRetEvento(ret('491')).ok, false);
await assert.rejects(eventoCienciaAssinado({ cnpj: '1', chave, ambiente: 'producao', certPem, keyPem: '-----BEGIN RSA PRIVATE KEY-----\nAA\n-----END RSA PRIVATE KEY-----' }));
console.log('ciencia: ok');
