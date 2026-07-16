# Problemas Comuns

## Senha esquecida

Validar identidade e usar fluxo administrativo seguro. Nao enviar senha antiga.

## Sessao expirada

Orientar sair e entrar novamente. Se persistir, verificar health da API.

## Usuario bloqueado

PLATFORM_ADMIN deve revisar status do usuario e motivo de suspensao.

## Loja desativada

Verificar status da loja. Loja suspensa/inativa nao deve operar.

## Pedido travado

Verificar historico do pedido, status atual e se ha motoboy atribuido.

## Motoboy sem pedido

Confirmar vinculo aprovado, loja ativa e pedidos confirmados/disponiveis.

## Estoque divergente

Conferir historico de movimentacoes, vendas PDV e pedidos delivery.

## Caixa divergente

Conferir abertura, sangrias, suprimentos, vendas e fechamento.

## Upload falhando

Verificar tamanho, tipo de arquivo, rede e readiness de storage.

## CSV/relatorio

Validar periodo, permissao e se ha dados no intervalo.

