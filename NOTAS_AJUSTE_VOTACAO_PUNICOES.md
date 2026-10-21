# Ajuste da votação de punições — UPALELE

- A categoria Punição oferece opções como Advertência, ganchos por 1/2/3/5 guerras, gancho por dias, Kick definitivo e outra punição.
- A opção vencedora passa a ser a punição registrada; não existe mais uma opção genérica “Aprovar” separada.
- Em empate, o líder escolhe uma das opções empatadas.
- Cada votação só pode criar um registro de punição, usando `source_vote_id`.
- Kick definitivo é guardado no histórico com status `served`, pois o site não consegue remover o membro diretamente do Clash of Clans; a liderança precisa executar o kick no jogo.
- As opções padrão podem ser ajustadas no campo de opções antes de criar a votação. Não inclua afastamento temporário.

## Importante
O teste TypeScript ainda mostra erros preexistentes de tipagem de cookies em `lib/supabase/server.ts` e `middleware.ts`. Não foi possível declarar este pacote pronto para produção. Teste em ambiente local e use uma votação de teste antes de aplicar punições reais.

## Atualização de opções (20/10/2026)
- Opções padrão de punição: advertência; ganchos de 1, 2, 3 e 5 guerras; ganchos de 7, 14 e 30 dias; kick definitivo; outra punição personalizada.
- Removida a referência a afastamento temporário.
- Ao vencer um gancho por dias, a integração calcula `applied_on` e `return_date` no registro de punições. Ganchos por guerras continuam usando `duration_wars`.
- O resultado ainda requer teste no Supabase real; não considerar pronto para produção sem testar votação, desempate, registro e permissões.
