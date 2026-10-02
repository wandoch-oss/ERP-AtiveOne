// Cofre do certificado digital: lê o .pfx/.p12 e guarda só PEMs cifrados (AES-GCM) — a senha do arquivo nunca é gravada.
// A biblioteca node-forge é injetada para o mesmo código rodar na Edge Function (npm:node-forge) e nos testes (node).

const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function chaveAes(segredo: string) {
  const h = await crypto.subtle.digest('SHA-256', enc.encode(segredo));
  return crypto.subtle.importKey('raw', h, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function cifrar(segredo: string, texto: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await chaveAes(segredo), enc.encode(texto)));
  return 'v1.' + b64(iv) + '.' + b64(ct);
}
export async function decifrar(segredo: string, pacote: string): Promise<string> {
  const [v, iv, ct] = pacote.split('.');
  if (v !== 'v1' || !iv || !ct) throw new Error('Formato de certificado guardado desconhecido.');
  try {
    return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(iv) }, await chaveAes(segredo), deB64(ct)));
  } catch (_) {
    throw new Error('Não foi possível abrir o certificado guardado: o segredo CERT_KEY mudou?');
  }
}

export type InfoCert = { certPem: string; keyPem: string; titular: string; cnpjCert: string; validade: string; inicio: string; fingerprint: string };

// deno-lint-ignore no-explicit-any
export function lerPfx(forge: any, pfxB64: string, senha: string): InfoCert {
  let p12;
  try {
    const der = forge.util.decode64(pfxB64.replace(/\s/g, ''));
    p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), false, senha);
  } catch (e) {
    const m = String((e as Error).message || e);
    if (/password|MAC/i.test(m)) throw new Error('Senha do certificado incorreta.');
    throw new Error('Arquivo de certificado inválido (use o .pfx ou .p12 do certificado A1).');
  }
  const bag = (tipo: string) => (p12.getBags({ bagType: tipo })[tipo] || []);
  const chaves = [...bag(forge.pki.oids.pkcs8ShroudedKeyBag), ...bag(forge.pki.oids.keyBag)].map((b) => b.key).filter(Boolean);
  const certs = bag(forge.pki.oids.certBag).map((b) => b.cert).filter(Boolean);
  if (!chaves.length || !certs.length) throw new Error('O arquivo não tem certificado e chave privada (precisa ser um A1 em .pfx).');
  const chave = chaves[0];
  const folha = certs.find((c) => c.publicKey && c.publicKey.n && chave.n && c.publicKey.n.compareTo(chave.n) === 0);
  if (!folha) throw new Error('A chave privada não corresponde a nenhum certificado do arquivo.');
  const ordem = [folha, ...certs.filter((c) => c !== folha)];
  const cn = (folha.subject.getField('CN') || { value: '' }).value as string;
  const achado = String(cn).match(/(\d{14})/) || JSON.stringify(folha.subject.attributes.map((a: { value: unknown }) => a.value)).match(/(\d{14})/);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    certPem: ordem.map((c) => forge.pki.certificateToPem(c)).join(''),
    keyPem: forge.pki.privateKeyInfoToPem(forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(chave))),
    titular: cn, cnpjCert: achado ? achado[1] : '',
    validade: iso(folha.validity.notAfter), inicio: iso(folha.validity.notBefore),
    fingerprint: forge.md.sha1.create().update(forge.asn1.toDer(forge.pki.certificateToAsn1(folha)).getBytes()).digest().toHex(),
  };
}
