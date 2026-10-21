# Clan Hub UPALELE — Next.js + Supabase

## Requisitos
- Node.js LTS instalado
- Visual Studio Code
- Projeto Supabase já criado
- As tabelas base foram criadas no Supabase e o perfil de líder foi inserido manualmente.

## 1. Abrir o projeto
Extraia o ZIP, abra a pasta `Clan_Hub_NextJS` no VS Code e abra Terminal > New Terminal.

## 2. Instalar dependências
```bash
npm install
```

## 3. Configurar ambiente
Copie `.env.local.example` para `.env.local`.
No Supabase, obtenha Project URL e Publishable key em Connect / API Keys e preencha:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Não coloque `service_role`, secret keys ou o token da API do Clash of Clans em variáveis `NEXT_PUBLIC_*`. Não compartilhe segredos no chat.

## 4. Importar os dados do clã
No Supabase SQL Editor, abra e execute `supabase/migrations/0002_seed_clan_data.sql`.
Este script importa as regras do memorial, os ganchos listados como ativos, o histórico antigo preservando datas/notas sem inventar status, e as notas operacionais. O script foi escrito para evitar duplicações comuns ao executar novamente.

**Atenção:** o memorial foi organizado a partir do protótipo derivado do material enviado. Revise-o contra o documento original antes de considerar o conteúdo uma publicação oficial. Os ganchos vêm de uma lista cuja situação precisa ser confirmada.

## 5. Executar localmente
```bash
npm run dev
```
Abra http://localhost:3000

## Login
Use o e-mail/senha do usuário criado em Supabase Authentication. O perfil desse usuário precisa existir em `public.profiles` com o mesmo UID. Não há cadastro público nesta versão.

## Incluído
- Login com Supabase Auth
- Painel conectado ao banco
- Memorial com busca e filtros por seção
- Ganchos ativos
- Histórico punitivo antigo
- Cadastro operacional
- Assistente de ataques baseado no memorial enviado
- Botão de logout

## Limitações e segurança
- A Central da Liderança/votação não está implementada até receber memorial interno atualizado.
- A API de Clash of Clans ainda não está conectada.
- O projeto não substitui uma revisão das políticas RLS antes de produção.
- Os registros de punições são legíveis para membros autenticados conforme a política atual. Se esse histórico deve ser exclusivo da liderança, é necessário alterar a política antes de lançar publicamente.
- As permissões de papel não devem ser editáveis pelos próprios membros; faça promoção de cargos por procedimento administrativo seguro.
