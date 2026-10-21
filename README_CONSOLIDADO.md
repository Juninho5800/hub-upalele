# Clan Hub UPALELE — pacote consolidado

Este pacote reúne o site Next.js, scripts do Supabase e os documentos originais do clã.

## Abrir o site localmente
1. Abra esta pasta no VS Code.
2. Abra **Terminal → Novo Terminal**.
3. Execute `npm.cmd install` (se ainda não instalou as dependências).
4. Se já configurou o projeto, mantenha seu `.env.local` local. Caso contrário, copie `.env.local.example` para `.env.local` e preencha a URL e a publishable key do Supabase.
5. Execute `npm.cmd run dev`.
6. Abra `http://localhost:3000` no navegador.

Mantenha o terminal aberto enquanto usa o site.

## Banco de dados
A pasta `supabase/migrations/` contém os scripts SQL:
- `0001_initial_schema.sql`: criação inicial das tabelas e tipos. **Como o banco do projeto atual já foi criado, não execute este script novamente no banco existente.** Ele serve como referência para uma instalação nova.
- `0002_seed_clan_data.sql`: dados de referência já usados no projeto.
- `0003_memorial_completo.sql`: importação do memorial geral completo, já executada com sucesso pelo usuário.

Não é necessário executar novamente os scripts que já foram aplicados com sucesso.

## Documentos
Consulte `documentos/LEIA-ME_DOCUMENTOS.md`. Os textos originais foram preservados para referência. O Memorial da Liderança ainda não está integrado a uma página privada do site; por enquanto, está guardado no pacote como documento oficial de referência.

## Importante
- Não inclua `.env.local` com credenciais em ZIPs compartilhados.
- Antes de publicar o site para outras pessoas, revisar as políticas de segurança/RLS e restringir dados do histórico punitivo à liderança, se essa for a regra desejada.

## Central da Liderança
A página `/lideranca` mostra o Memorial Descritivo da Liderança e é restrita a perfis ativos com função `leader` ou `co_leader`. A verificação ocorre no servidor antes de renderizar o conteúdo. O documento original permanece em `documentos/originais/Memorial_Descritivo_Lideranca_Original.txt`.
