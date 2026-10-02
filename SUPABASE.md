# Colocar o Ative Hub no Supabase

O sistema continua sendo só arquivos estáticos (HTML, CSS e JS). O Supabase guarda os
dados, o login e os arquivos anexados. O site fica num serviço de páginas estáticas
(GitHub Pages, Netlify ou Hostinger comum).

A estrutura já é multiempresa: cada registro tem `org_id`, e as regras do banco (RLS)
só deixam cada usuário ver os dados da empresa à qual pertence.

## 1. Criar o projeto
1. Entre em https://supabase.com e crie um projeto. Escolha a região **South America (São Paulo)**.
2. Guarde a senha do banco num lugar seguro.

## 2. Criar as tabelas
1. No painel, abra **SQL Editor → New query**.
2. Cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Isso cria as tabelas `organizacoes`, `membros` e `registros`, as regras de acesso,
   o tempo real e o bucket privado `anexos` para os arquivos.

## 3. Login
1. **Authentication → Sign In / Providers → Email**: deixe ativo.
2. Desative **Allow new users to sign up**. Assim só entra quem você cadastrar.
3. **Authentication → Users → Add user → Create new user**: crie o seu usuário
   (e-mail e senha, marque *Auto Confirm User*).
4. **Authentication → URL Configuration**: em *Site URL*, coloque o endereço do site
   (ex.: `https://wandoch-oss.github.io/ERP-AtiveOne/`). É para onde vai o link de "Esqueci a senha".

## 4. Ligar o sistema ao projeto
1. **Project Settings → API**: copie a *Project URL* e a chave **anon public**.
2. Copie `config.example.js` para `config.js` e preencha os dois valores.
3. A chave anon pode ficar no site: quem protege os dados são as regras do banco.
   **Nunca** use a chave `service_role` no site.

## 5. Publicar o site
GitHub Pages: no repositório, **Settings → Pages → Deploy from a branch**, escolha a branch e a pasta `/ (root)`.
O arquivo `.nojekyll` já está no projeto.

## 6. Primeiro acesso
1. Abra o site e entre com o seu usuário.
2. Como ainda não há empresa, o sistema pede o nome dela. Você vira o administrador.
3. Em **Cadastros → Dados → Importar backup**, carregue o backup exportado da versão atual.

## 7. Dar acesso à equipe
1. Crie o usuário da pessoa no painel (passo 3.3).
2. No sistema, **Cadastros → Dados → Dar acesso a um usuário**, informe o e-mail e o papel
   (*Membro* usa o sistema; *Administrador* também libera acessos).

## Custos
O plano Free serve para testar (o projeto pausa após 1 semana sem uso). Para uso diário,
o plano Pro (US$ 25/mês) tem backup diário e não pausa.

## Depois (venda como SaaS)
A base já separa os dados por empresa. Para vender, faltam: cadastro de novas empresas
pelo próprio site, cobrança e marca própria por cliente.
