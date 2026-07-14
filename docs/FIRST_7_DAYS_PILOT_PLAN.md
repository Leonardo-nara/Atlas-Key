# Plano dos primeiros sete dias do piloto

## Categorias de problema

- Critico: interrompe operacao real, risco financeiro, perda de pedido/venda/caixa/estoque ou falha de seguranca. Pode exigir pausa imediata.
- Alto: impacta operacao diaria, mas ha contorno seguro.
- Medio: atrito operacional relevante sem risco imediato.
- Baixo: problema visual ou texto confuso sem impacto operacional.
- Melhoria futura: desejo de produto fora do piloto inicial.

## Dia 0

- Configurar empresa.
- Criar administrador.
- Realizar treinamento.
- Configurar produtos, estoque, taxas, caixa e Pix manual se usado.
- Executar teste controlado de pedido.
- Executar teste controlado de PDV.
- Validar prontidao.
- Registrar responsavel e horario de inicio fora do Git.

## Dia 1

- Acompanhar primeiros pedidos reais.
- Acompanhar vendas PDV.
- Conferir caixa aberto/fechado.
- Conferir pagamentos pendentes.
- Conferir falhas de acesso.
- Conferir estoque baixo ou zerado.
- Executar `pilot:check:prod`.
- Registrar incidentes criticos imediatamente.

## Dias 2 e 3

- Revisar operacao com a empresa.
- Corrigir bugs bloqueadores em branch isolada.
- Validar relatorios.
- Revisar tempos de pedido, entrega e fechamento.
- Revisar dificuldades de equipe.
- Separar melhorias futuras de bugs reais.

## Dias 4 a 6

- Observar estabilidade.
- Revisar experiencia da loja.
- Revisar experiencia do cliente.
- Revisar experiencia do motoboy.
- Medir frequencia de erros operacionais.
- Registrar melhorias nao bloqueadoras.

## Dia 7

- Revisao geral do piloto.
- Conferir pedidos, vendas, caixa, estoque e relatorios.
- Decidir continuidade.
- Definir lista de correcoes.
- Aprovar ou nao ampliacao do piloto.

## Regras de pausa

Pausar ou restringir operacao se houver:

- Pedido ou venda sendo atribuido a loja errada.
- Falha de permissao entre lojas.
- Divergencia financeira sem explicacao.
- Caixa inconsistente sem contorno.
- Estoque sendo baixado incorretamente.
- Erro de login que bloqueie equipe real.
- Exposicao de dado sensivel.
