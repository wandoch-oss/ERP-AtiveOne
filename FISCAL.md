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
| NF-e recebida (CNPJ é o destinatário) | Conferência de sempre: entrada no estoque, conta a pagar, rateio por projeto. Se houver pedido de compra em aberto (Enviado/Confirmado) do mesmo fornecedor com o mesmo valor (±1%), ele é indicado e marcado como Recebido |
| NF-e emitida pela empresa | Registra na lista de notas e vincula à conta a receber em aberto do mesmo cliente (pelo CPF/CNPJ do cadastro) com o mesmo valor (±1%). Não dá baixa: o recebimento continua pendente. Sem correspondência, aparece o selo “sem conta a receber” |
| NFS-e recebida | Registra e cria conta a pagar (vencimento em 30 dias) |
| NFS-e emitida | Mesmo tratamento da NF-e emitida |
| Resumo de NF-e (`resNFe`) | Botão **Dar ciência e liberar o XML**: registra a Ciência da operação (evento 210210) na Receita; o XML completo chega na próxima busca |

## Segurança do certificado
- O certificado A1 contém a chave privada da empresa: quem o usa pode assinar em nome dela. Por isso o arquivo e a senha
  vão por HTTPS direto à função; a **senha não é gravada**; os PEMs ficam **cifrados (AES-GCM)** numa tabela sem nenhuma
  regra de acesso para o navegador, e a tela só recebe titular, validade e impressão digital.
- Quem tiver a chave de serviço do Supabase **e** o `CERT_KEY` consegue abrir o certificado. Proteja os dois (e o acesso ao
  painel do Supabase) como protegeria o próprio certificado.
- Só o administrador da empresa envia ou remove. O certificado vence (A1 dura 1 ano): a tela avisa 30 dias antes.

## Histórico de consultas
Em Compras → Buscar notas na Receita → **Histórico de consultas** aparecem as últimas 100 operações: buscas (manuais e
agendadas), manifestações e envio/remoção de certificado, com o código da Receita, quantas notas vieram e a mensagem.
Serve para diagnosticar o primeiro teste: erro de certificado, 656 (esperar ~1 hora), 137 (nada novo) etc.

## Manifestação do destinatário
Na lista **Notas importadas**, a coluna *Manifestação* tem o botão **Manifestar** para NF-e recebidas:
Confirmação da operação (210200), Desconhecimento (210220) e Operação não realizada (210240, com justificativa de 15 a 255
caracteres). A Receita registra e não aceita desfazer. A *Ciência* continua sendo feita pelo botão dos resumos.

## Aviso de notas paradas
Notas buscadas e ainda não conferidas aparecem como selo no menu (Pedido de Compra) e no Painel, em vermelho quando
passam de 3 dias.

## Limites que vêm da Receita (não do sistema)
- A distribuição de NF-e entrega as notas em que o CNPJ é **destinatário** (ou foi indicado para baixar o XML).
  Notas emitidas pela própria empresa normalmente não chegam por esse serviço; se chegarem, o sistema
  as reconhece pelo CNPJ do emitente. Confirme no primeiro teste.
- Sem a **Ciência da operação** a SEFAZ envia só o resumo da nota. O sistema registra a ciência (só informa conhecimento;
  não confirma nem recusa a compra).
- Depois de uma consulta sem novidades a SEFAZ exige ~1 hora de intervalo (erro 656, consumo indevido). A função
  respeita isso e avisa até que horas.

## Implantação
1. Rode de novo `supabase/schema.sql` no SQL Editor (cria as tabelas fiscais, o histórico e o cofre do certificado).
2. Defina o segredo que cifra os certificados guardados no banco (uma frase longa e aleatória, 16+ caracteres; **guarde-a
   num gerenciador de senhas — se ela mudar, será preciso reenviar os certificados**):
   ```
   supabase secrets set CERT_KEY="uma-frase-longa-e-aleatoria"
   ```
3. Publique a função: `supabase functions deploy buscar-notas`
4. No sistema, **Cadastros → Empresas → (a empresa) → Certificado digital**: escolha o `.pfx`/`.p12` do certificado A1, digite a
   senha e envie. O sistema mostra titular, validade e impressão digital; o administrador pode remover quando quiser.
   Cada empresa/CNPJ tem o seu certificado.
5. Se a conexão com a SEFAZ falhar por certificado desconhecido, a cadeia ICP-Brasil não está no servidor: baixe a cadeia no site
   do ITI e informe em `SEFAZ_CA_PEM` (`supabase secrets set SEFAZ_CA_PEM="$(cat cadeia.pem)"`).

> **Alternativa sem o cadastro:** ainda dá para usar um único certificado para tudo guardando os PEMs nos secrets
> `CERT_PEM` e `KEY_PEM` (veja abaixo). É usada quando a empresa não tem certificado enviado pela tela.
> ```
> openssl pkcs12 -in certificado.pfx -clcerts -nokeys -out cert.pem -legacy
> openssl pkcs12 -in certificado.pfx -nocerts -nodes  -out key.pem  -legacy
> supabase secrets set CERT_PEM="$(cat cert.pem)" KEY_PEM="$(cat key.pem)"
> ```
6. Cadastre a empresa com **CNPJ válido e UF** (Cadastros → Empresas) e use o botão em Compras.
7. **Busca automática diária** (opcional, faça só depois de validar a busca manual em homologação):
   - `supabase secrets set CRON_SECRET="uma-frase-longa-e-aleatoria"`
   - No SQL Editor (troque os três valores em maiúsculas; 09:00 UTC = 06:00 em Brasília):
     ```sql
     create extension if not exists pg_cron;
     create extension if not exists pg_net;
     select cron.schedule('buscar-notas-diario', '0 9 * * *', $$
       select net.http_post(
         url := 'https://SEU-PROJETO.supabase.co/functions/v1/buscar-notas',
         headers := '{"Content-Type":"application/json","Authorization":"Bearer CHAVE-ANON","x-cron-secret":"MESMA-FRASE"}'::jsonb,
         body := '{"acao":"agendada"}'::jsonb) $$);
     ```
   - No sistema, em Compras → Buscar notas na Receita, o administrador clica em **Ligar** na busca automática.
     Só os CNPJs ligados são consultados. Para parar: **Desligar** (ou `select cron.unschedule('buscar-notas-diario');`).

Para testar sem valer: em `config.js` coloque `fiscalAmbiente:'homologacao'`.

## Ainda não testado contra a Receita
O código foi escrito pela documentação dos serviços e testado só com respostas simuladas
(`node --experimental-strip-types supabase/functions/buscar-notas/fiscal.test.mjs` e `ciencia.test.mjs`; a Edge Function em si — `index.ts` — nunca rodou, só foi lida pelo analisador). Pontos a validar no
primeiro uso em homologação: se o Supabase aceita o certificado de cliente (`Deno.createHttpClient`),
a cadeia de certificados da SEFAZ, o formato do NSU da NFS-e nacional e se a SEFAZ aceita a assinatura do evento de ciência
(a assinatura é conferida localmente contra o C14N real, mas só a Receita valida de fato). A chave `KEY_PEM` precisa estar em
PKCS#8 (`BEGIN PRIVATE KEY`), que é o que o comando do passo 2 gera.
