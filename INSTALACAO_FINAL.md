# Clan Hub UPALELE — pacote consolidado

Este pacote reúne o projeto Next.js, a integração Supabase, o Memorial do clã, a Central da Liderança, o Sistema de Votações e os documentos originais.

## Conteúdo incluído
- Visão geral e páginas do Clan Hub.
- Memorial geral do clã.
- Central da Liderança baseada no documento fornecido.
- Sistema de votação da liderança.
- Assistente de ataques, ganchos, histórico punitivo e membros.
- Migrações SQL numeradas e documentos originais.

## Para continuar no computador onde o site já funciona
1. Faça uma cópia de segurança da pasta atual `Clan_Hub_NextJS`.
2. Extraia este ZIP em uma pasta separada.
3. Copie o arquivo `.env.local` do seu projeto atual para a pasta `Clan_Hub_NextJS` desta versão. Não compartilhe esse arquivo.
4. Abra a pasta no VS Code e execute no terminal:
   ```powershell
   npm.cmd install
   npm.cmd run dev
   ```
5. Acesse `http://localhost:3000`.

## Supabase
O banco do usuário já recebeu as migrações iniciais, o seed e o Memorial completo. **Não execute novamente `0001`, `0002` ou `0003`.** Para ativar as votações, abra `supabase/migrations/0004_sistema_votacoes.sql` no SQL Editor do Supabase e execute o arquivo inteiro uma única vez. Se já executou essa migração com sucesso, não a execute novamente.

## Acesso
- A Central da Liderança e as Votações são destinadas a perfis ativos com `role` igual a `leader` ou `co_leader`.
- O projeto depende das variáveis Supabase configuradas em `.env.local`.

## Importante
Este pacote é uma consolidação do código e dos documentos, não uma publicação automática na internet. O site local precisa do servidor em execução. Antes de usar em produção, faça testes de permissões e políticas RLS no Supabase.
