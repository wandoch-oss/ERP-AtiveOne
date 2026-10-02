# Buscar notas fiscais na Receita

Em **Compras → Buscar notas na Receita** o sistema traz as notas do CNPJ da empresa:

- **NF-e** pela SEFAZ (serviço *NFeDistribuicaoDFe*, Ambiente Nacional);
- **NFS-e** pelo padrão nacional (ADN).

A Receita exige o **certificado digital A1** da empresa, que não pode ficar no navegador. Por isso a
consulta roda numa Edge Function do Supabase (`supabase/functions/buscar-notas`). Ela guarda os XMLs na
tabela `fiscal_docs`; o sistema lê de lá e abre a conferência. Nada entra no estoque ou no financeiro
sem você confirmar.

## O que cada tipo de nota faz
| Nota | Ao importar |
|---|---|
| NF-e recebida (CNPJ é o destinatário) | Conferência de sempre: entrada no estoque, conta a pagar, rateio por projeto |
| NF-e emitida pela empresa | Só registra na lista de notas |
| NFS-e recebida | Registra e cria conta a pagar (vencimento em 30 dias) |
| NFS-e emitida | Só registra |
| Resumo de NF-e (`resNFe`) | Só lista. A SEFAZ manda o XML completo depois da *Ciência da operação* |

## Limites que vêm da Receita (não do sistema)
- A distribuição de NF-e entrega as notas em que o CNPJ é **destinatário** (ou foi indicado para baixar o XML).
  Notas emitidas pela própria empresa normalmente não chegam por esse serviço; se chegarem, o sistema
  as reconhece pelo CNPJ do emitente. Confirme no primeiro teste.
- Sem a **Ciência da operação** (evento assinado, feito no portal da NF-e ou no programa que você já usa),
  a SEFAZ envia só o resumo da nota. O sistema ainda não registra esse evento.
- Depois de uma consulta sem novidades a SEFAZ exige ~1 hora de intervalo (erro 656, consumo indevido). A função
  respeita isso e avisa até que horas.

## Implantação
1. Rode de novo `supabase/schema.sql` no SQL Editor (cria `fiscal_cursor` e `fiscal_docs`).
2. Converta o certificado `.pfx` em PEM (no seu computador):
   ```
   openssl pkcs12 -in certificado.pfx -clcerts -nokeys -out cert.pem -legacy
   openssl pkcs12 -in certificado.pfx -nocerts -nodes  -out key.pem  -legacy
   ```
   (se a sua versão do openssl não aceitar `-legacy`, tire essa opção)
3. Guarde nos *secrets* da função (nunca no site nem no repositório):
   ```
   supabase secrets set CERT_PEM="$(cat cert.pem)" KEY_PEM="$(cat key.pem)"
   ```
   Se a conexão com a SEFAZ falhar por certificado desconhecido, a cadeia ICP-Brasil não está no
   servidor: baixe a cadeia no site do ITI e informe em `SEFAZ_CA_PEM` do mesmo jeito.
4. Publique a função: `supabase functions deploy buscar-notas`
5. Apague `cert.pem` e `key.pem` do computador.
6. Cadastre a empresa com **CNPJ válido e UF** (Cadastros → Empresas) e use o botão em Compras.

Para testar sem valer: em `config.js` coloque `fiscalAmbiente:'homologacao'`.

## Ainda não testado contra a Receita
O código foi escrito pela documentação dos serviços e testado só com respostas simuladas
(`node --experimental-strip-types supabase/functions/buscar-notas/fiscal.test.mjs`). Pontos a validar no
primeiro uso em homologação: se o Supabase aceita o certificado de cliente (`Deno.createHttpClient`),
a cadeia de certificados da SEFAZ e o formato do NSU da NFS-e nacional.
