# Sistema de votação da liderança — UPALELE

## Instalação no projeto existente
1. Faça uma cópia da pasta do projeto antes de substituir arquivos.
2. Copie a pasta `app/votacoes` para o projeto atual.
3. Substitua `components/app-shell.tsx` pelo arquivo desta versão.
4. **Não substitua nem compartilhe o `.env.local`**.
5. No Supabase, abra o SQL Editor, crie uma consulta e execute o conteúdo completo de `supabase/migrations/0004_sistema_votacoes.sql` uma única vez, depois das migrações anteriores.
6. No terminal do VS Code, rode `npm.cmd run dev` e acesse `http://localhost:3000/votacoes` com uma conta ativa de líder ou colíder.

## Recursos
- Criar votação com título, contexto, categoria, opções e prazo de 1 a 168 horas (padrão: 24 horas).
- Um voto por pessoa por votação; o voto registrado não pode ser alterado pela interface.
- Contagem de votos e percentuais visíveis somente à liderança.
- O líder pode resolver empate escolhendo uma das opções empatadas.
- A votação pode ser encerrada pelo líder, quando todos os líderes/colíderes ativos já votaram, ou quando o prazo expira.
- A tabela de votos é protegida por Row Level Security do Supabase.

## Observações
- O sistema considera `profiles.role` com os valores `leader` e `co_leader`, e `profiles.is_active = true`.
- A regra descrita no memorial estabelece 24 horas para os colíderes votarem; decisões de guerra podem precisar de resolução antes do prazo operacional. A tela permite definir um prazo específico para cada votação, por isso use essa flexibilidade conforme o memorial e o contexto.
- Execute a migração SQL somente uma vez. Se o Supabase apresentar erro, não repita as migrações iniciais; compartilhe a mensagem do erro.
