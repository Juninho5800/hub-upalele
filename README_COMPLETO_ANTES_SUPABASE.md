# Clan Hub UPALELE — pacote consolidado de desenvolvimento

Este é o pacote de trabalho consolidado para configurar o projeto uma única vez. A integração real com Supabase e Clash of Clans depende de credenciais e validação no ambiente do usuário; não declare o sistema pronto para produção antes dos testes.

## Áreas incluídas no código
- Visão geral do clã.
- Memorial geral e memorial da liderança, com pesquisa.
- Assistente de ataques (ainda exige validação das regras e da guerra real; não trata uma recomendação manual como dado oficial).
- Ganchos ativos e histórico punitivo legado.
- Membros e anotações operacionais.
- Votações da liderança com opções de punição: advertência, ganchos por guerras, ganchos por dias, kick definitivo e opção personalizada. O kick precisa ser executado manualmente no jogo.
- Central da liderança.
- Eventos para guerra, liga, raide, jogos do clã, doações, inatividade e outros.
- War Room para visualizar guerras e ataques já sincronizados no banco.
- Endpoint server-side `/api/clash/current-war` que consulta a API oficial quando `CLASH_API_TOKEN` está configurado.

## Configuração posterior do Supabase
1. Configure `.env.local` a partir de `.env.local.example`.
2. Revise e aplique as migrações na ordem, considerando quais já foram executadas no projeto Supabase existente. Não reexecute migrações iniciais cegamente.
3. Verifique RLS, funções, perfis e roles antes de convidar membros.
4. Aplique a migração `0006_eventos_confirmacoes_notificacoes.sql` apenas depois de confirmar a situação das anteriores.

## API Clash of Clans
- Configure `CLASH_API_TOKEN` como variável privada de servidor e `CLAN_TAG` como tag do clã.
- Não use `NEXT_PUBLIC_CLASH_API_TOKEN` e não exponha o token no navegador.
- O endpoint atual é uma base de consulta; sincronização persistente para `wars`/`war_attacks`, notificações externas e validação automática de regras ainda precisam de testes de integração antes de uso operacional.

## Executar localmente
```powershell
npm.cmd install
npm.cmd run dev
```
Acesse `http://localhost:3000`.

## Critérios antes de produção
- `npm run build` sem erros.
- Login e permissões testados com membro, colíder e líder.
- Testes de RLS e migrações no Supabase.
- Testes de voto, empate, encerramento e criação idempotente de punição.
- Testes de datas de retorno por dias e por guerras.
- API Clash testada com guerras em preparação, em andamento, encerradas e estado privado.
- Backup e plano de reversão das migrações.
