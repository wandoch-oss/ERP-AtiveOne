// Rodar: FORGE=/caminho/node_modules/node-forge/lib/index.js node --experimental-strip-types cofre.test.mjs   (ou npm i node-forge)
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { cifrar, decifrar, lerPfx } from './cofre.ts';

const forge = (process.env.FORGE ? createRequire(import.meta.url)(process.env.FORGE) : (await import('node-forge')).default);
const d = execSync('mktemp -d').toString().trim();
execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${d}/k.pem -out ${d}/c.pem -days 30 -subj "/C=BR/O=ICP-Brasil/CN=ATIVE ONE LTDA:12345678000195" 2>/dev/null`);
for (const [nome, extra] of [['moderno', ''], ['legado', '-legacy']]) {
  try { execSync(`openssl pkcs12 -export -inkey ${d}/k.pem -in ${d}/c.pem -out ${d}/${nome}.pfx -passout pass:segredo123 ${extra} 2>/dev/null`); } catch { console.log(nome, 'não gerado pelo openssl daqui'); continue; }
  const b64 = readFileSync(`${d}/${nome}.pfx`).toString('base64');
  const r = lerPfx(forge, b64, 'segredo123');
  assert.equal(r.titular, 'ATIVE ONE LTDA:12345678000195'); assert.equal(r.cnpjCert, '12345678000195');
  assert.match(r.keyPem, /BEGIN PRIVATE KEY/); assert.match(r.certPem, /BEGIN CERTIFICATE/);
  assert.match(r.validade, /^\d{4}-\d\d-\d\d$/); assert.equal(r.fingerprint.length, 40);
  assert.throws(() => lerPfx(forge, b64, 'errada'), /Senha do certificado incorreta/);
  // a chave convertida é utilizável pelo WebCrypto (é o que assina os eventos)
  const corpo = r.keyPem.replace(/-----[^-]+-----|\s/g, '');
  await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(corpo), (c) => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' }, false, ['sign']);
  console.log(nome, 'ok');
}
assert.throws(() => lerPfx(forge, Buffer.from('lixo').toString('base64'), 'x'), /inválido/);

const p = await cifrar('meu-segredo', 'PEM secreto');
assert.ok(!p.includes('PEM secreto')); assert.equal(await decifrar('meu-segredo', p), 'PEM secreto');
assert.notEqual(await cifrar('meu-segredo', 'PEM secreto'), p); // IV novo a cada vez
await assert.rejects(decifrar('outro-segredo', p), /CERT_KEY/);
console.log('cofre: ok');
