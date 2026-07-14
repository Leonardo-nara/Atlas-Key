# Runbook do piloto operacional com empresa real

Este runbook prepara o cadastro, a validacao e o acompanhamento da primeira empresa real no Mototake.

Regras fixas desta fase:

- Nao inventar dados da empresa.
- Nao cadastrar produtos, pedidos, vendas, taxas ou motoboys ficticios em producao.
- Nao ativar Pix automatico.
- Nao alterar `PAYMENT_GATEWAY_ENABLED` ou `PAYMENT_GATEWAY_PROVIDER`.
- Nao apagar dados reais.
- Preservar historico operacional.

## 1. Antes do cadastro

Coletar e confirmar com o responsavel:

- Razao social ou nome da empresa.
- Nome comercial.
- Nome do responsavel operacional.
- E-mail do administrador da loja.
- Telefone de contato.
- Endereco completo.
- Cidade, estado e CEP.
- Documento da empresa, somente se a operacao exigir e houver campo suportado.
- Timezone de operacao.
- Operacao com delivery, retirada e/ou PDV.
- Metodos de pagamento iniciais: dinheiro, cartao na entrega e/ou Pix manual.
- Motoboys que farao parte do piloto.
- Bairros atendidos e taxas de entrega.
- Horario de operacao.
- Politica de estoque.
- Uso de caixa/PDV.
- Data e horario de treinamento.

## 2. Cadastro controlado

Executar primeiro em dry-run:

```powershell
$env:PILOT_STORE_NAME="<nome oficial>"
$env:PILOT_TRADE_NAME="<nome comercial>"
$env:PILOT_ADMIN_NAME="<responsavel>"
$env:PILOT_ADMIN_EMAIL="<email>"
$env:PILOT_PHONE="<telefone>"
$env:PILOT_ADDRESS="<endereco>"
$env:PILOT_CITY="<cidade>"
$env:PILOT_STATE="<estado>"
$env:PILOT_ZIP_CODE="<cep>"
$env:PILOT_TIMEZONE="America/Sao_Paulo"
$env:PILOT_PAYMENT_METHODS="CASH,CARD_ON_DELIVERY,PIX_MANUAL"
pnpm --filter @deliveries/backend pilot:create:prod
```

Executar criacao real somente apos aprovacao explicita:

```powershell
$env:PILOT_ENV="production"
$env:PILOT_STORE_CONFIRM="CREATE_REAL_PILOT_STORE"
pnpm --filter @deliveries/backend pilot:create:prod -- --apply
```

O script cria apenas:

- Usuario `STORE_ADMIN`.
- Loja ativa associada ao usuario.
- Arquivo local ignorado pelo Git em `.demo-local/pilot-store-credentials.json`.

O script nao cria:

- Produtos.
- Pedidos.
- Vendas.
- Taxas.
- Caixa.
- Motoboys.
- Pix automatico.

## 3. Primeiro acesso

1. Abrir o painel oficial.
2. Entrar com o usuario criado.
3. Trocar a senha temporaria assim que houver suporte nativo ou procedimento operacional definido.
4. Confirmar que o usuario ve apenas a area da loja.
5. Confirmar que nao ha acesso a area `PLATFORM_ADMIN`.

## 4. Configuracao inicial

Configurar com a empresa:

- Perfil da loja.
- Produtos reais.
- Precos reais.
- Controle de estoque, quando aplicavel.
- Taxas por bairro.
- Pix manual, se usado.
- Dinheiro e cartao na entrega.
- Caixa/PDV.
- Motoboys e vinculos.
- Checklist de prontidao.

## 5. Teste controlado

Usar um produto claramente identificado como teste, se a empresa aprovar.

Validar:

- Pedido de cliente.
- Aceite da loja.
- Taxa de entrega.
- Atribuicao de motoboy.
- Entrega.
- Baixa/reserva de estoque.
- Pagamento.
- PDV.
- Caixa.
- Relatorios.

Cancelar ou remover somente dados de teste que possam ser removidos com seguranca e que nao afetem historico real.

## 6. Entrada em operacao

Antes de operar com clientes reais:

- Confirmar prontidao.
- Confirmar equipe treinada.
- Confirmar produtos e precos.
- Confirmar estoque inicial.
- Confirmar taxas.
- Confirmar caixa.
- Confirmar canais de suporte.
- Registrar data/hora de inicio do piloto.

## 7. Acompanhamento

Executar verificacao operacional:

```powershell
pnpm --filter @deliveries/backend pilot:check:prod -- --store-id=<storeId>
```

Saida JSON:

```powershell
pnpm --filter @deliveries/backend pilot:check:prod -- --store-id=<storeId> --json
```

## 8. Encerramento do piloto

Revisar:

- Pedidos.
- Vendas PDV.
- Caixa.
- Estoque.
- Pagamentos.
- Relatorios.
- Erros e dificuldades.
- Melhorias nao bloqueadoras.

Decidir:

- Continuar.
- Pausar para correcao.
- Encerrar preservando historico.

## 9. Desativacao segura

Nao apagar empresa real com historico.

Dry-run:

```powershell
pnpm --filter @deliveries/backend pilot:deactivate:prod -- --store-id=<storeId> --reason="Encerramento do piloto"
```

Aplicacao real somente com confirmacoes:

```powershell
$env:PILOT_ENV="production"
$env:PILOT_DEACTIVATE_CONFIRM="DEACTIVATE_PILOT_STORE"
pnpm --filter @deliveries/backend pilot:deactivate:prod -- --store-id=<storeId> --reason="Encerramento do piloto" --apply
```

Efeito:

- Loja fica `INACTIVE`.
- Administrador fica `INACTIVE`.
- Sessoes do administrador sao revogadas.
- Vinculos de motoboys pendentes/aprovados sao bloqueados.
- Pedidos, vendas, caixa, estoque e relatorios sao preservados.
