# Integração: votação aprovada → gancho ativo

## O que muda
- Votações da categoria **Punição** passam a pedir nick, tipo de punição, duração em guerras (quando aplicável), motivo e qual opção representa aprovação.
- Ao encerrar a votação, o gancho é criado em `punishments` somente se a opção de aprovação vencer (ou for escolhida no desempate do líder).
- `source_vote_id` vincula o gancho à votação e possui índice único para impedir duplicação por votação.
- A criação registra também uma linha em `punishment_audit`.
- Votações que não sejam de punição seguem o fluxo anterior. Registros históricos e ganchos existentes não são apagados nem reescritos.

## Instalação no Supabase
1. Abra o SQL Editor do projeto Supabase.
2. Execute o conteúdo de `supabase/migrations/0005_votacao_para_punicao.sql` uma vez.
3. Publique o código atualizado e faça login com perfil ativo de líder/colíder.
4. Crie uma votação da categoria **Punição**, incluindo entre as opções o texto configurado como aprovação (por exemplo, `Aprovar`).
5. Confira o gancho criado em **Ganchos ativos** e a trilha em `punishment_audit`.

## Atenção
- A integração usa a opção de aprovação configurada na criação; não tenta adivinhar se “Sim”, “A favor” ou outro rótulo significa aprovação.
- O encerramento da votação e a inserção da punição são duas operações separadas no cliente. Se a segunda falhar, a tela mostra erro e o registro deve ser regularizado pela liderança; o índice único protege contra duplicatas quando a criação for repetida.
- A automação ainda não significa que o site está publicado 24/7. É necessário deploy e configuração segura das variáveis de ambiente.
