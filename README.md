# Ative Hub

ERP web sem build para empresas de automação residencial e predial.

- `index.html` — estrutura da página
- `css/styles.css` — estilos
- `js/app.js` — estado, telas e persistência
- `js/supabase.js` — modo Supabase (login, dados por empresa, tempo real, arquivos)
- `js/proposta.js`, `js/plano.js`, `js/cronograma.js`, `js/arquivos.js`, `js/mobile.js` — módulos
- `js/fiscal.js` + `supabase/functions/buscar-notas` — busca de NF-e/NFS-e na Receita (veja `FISCAL.md`)
- `supabase/schema.sql` — tabelas e regras de acesso do Supabase

## Onde os dados ficam
- **Supabase**: quando existe `config.js` com `supabaseUrl` e `supabaseAnonKey`
  (veja `config.example.js` e o passo a passo em `SUPABASE.md`).
- **Firebase**: servido com `/__/firebase/init.json` (Firebase Hosting).
- **Local**: sem nada disso, os dados ficam no `localStorage` do navegador.
