# Pilot Readiness

## Checklist manual ponta a ponta

### Preparacao

1. Rodar `pnpm install`.
2. Rodar `docker compose up -d`.
3. Rodar `pnpm --filter @deliveries/backend prisma:deploy`.
4. Rodar `pnpm seed:demo`.
5. Subir backend, desktop e mobile.
6. Confirmar `GET /api/health`.

### Login e ambiente

1. Entrar no desktop com `store-admin@example.com / StrongPass123`.
2. Confirmar nome e endereco da loja na tela inicial.
3. Entrar no mobile com `courier@example.com / StrongPass123`.
4. Confirmar que o perfil do app mostra a URL correta da API.

### Catalogo e criacao

1. Abrir `Produtos` no desktop.
2. Validar estado vazio somente se a seed nao tiver rodado.
3. Criar um novo produto.
4. Editar esse produto.
5. Remover esse produto e confirmar o feedback visual.

### Fluxo principal de pedidos

1. Abrir `Pedidos` no desktop.
2. Criar um pedido com pelo menos um item.
3. Confirmar feedback de sucesso.
4. Verificar se o pedido aparece na listagem e no detalhe com historico inicial.
5. No mobile, abrir `Pedidos disponiveis`.
6. Confirmar que o pedido aparece sem refresh manual ou apos um pull-to-refresh.
7. Aceitar o pedido.
8. Confirmar que ele sai de `Pedidos disponiveis` e entra em `Meus pedidos`.
9. Atualizar para coletado.
10. Atualizar para entregue.
11. Voltar ao desktop e confirmar historico completo do pedido.

### Cancelamento

1. Criar um novo pedido no desktop.
2. Cancelar o pedido antes da entrega.
3. Informar um motivo.
4. Confirmar feedback de sucesso.
5. Confirmar que o historico registra `cancelled`.
6. Confirmar que o pedido cancelado nao aparece como disponivel no mobile.

### Resiliencia basica

1. Tentar login com senha incorreta no desktop.
2. Tentar login com senha incorreta no mobile.
3. Desligar o backend por alguns segundos e confirmar que a mensagem de erro de conexao fica clara.
4. Religar o backend e validar recuperacao por novo login ou refresh.

## Roteiro de demonstracao 5 a 10 minutos

1. Apresentar o objetivo do sistema: operacao simples entre loja e motoboy.
2. Mostrar login do lojista no desktop.
3. Mostrar o catalogo da loja.
4. Criar um pedido em tempo real no desktop.
5. Trocar para o mobile do motoboy e mostrar o pedido entrando.
6. Aceitar o pedido no mobile.
7. Atualizar para coletado e depois entregue.
8. Voltar ao desktop e mostrar o historico do pedido.
9. Criar um novo pedido e cancelar com motivo.
10. Encerrar mostrando que o fluxo principal, o realtime e a auditoria estao funcionando.

## Principais riscos restantes antes do piloto

- Ainda nao ha testes automatizados cobrindo os fluxos criticos.
- O desktop usa o dialogo nativo do navegador para confirmacoes, o que funciona, mas nao e a UX final.
- O mobile ainda nao tem reconexao guiada ou banner dedicado para perda de rede, apenas mensagens de erro e refresh manual.
- Nao ha observabilidade de producao como logs centralizados, error tracking ou metricas.
- Nao existe controle administrativo mais completo de usuarios, ativacao/inativacao e recuperacao de senha.
- A distribuicao desktop ainda usa icone padrao e pode precisar assinatura de codigo para ambientes mais formais.
