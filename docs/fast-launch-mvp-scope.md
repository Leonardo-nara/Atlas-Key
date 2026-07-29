# Escopo do Fast Launch MVP Mototake

Este documento congela o escopo da primeira versao comercial simplificada do Mototake. O objetivo e lancar rapido, com baixo custo e funcionamento real, sem depender de APIs pagas novas.

## Arquitetura de lancamento

### Mototake Empresas

- Cadastro e login.
- Painel premium existente.
- Produtos, categorias, estoque e disponibilidade.
- Taxas de entrega por bairro/regiao.
- Pix manual e base de Pix automatico ja existente, sem ativar novo gateway em producao nesta etapa.
- Pedidos, gestao de entregas e acompanhamento por status.
- Gestao e autorizacao de motoboys.
- Link publico da loja.
- Loja online ativa/pausada.
- Horarios e tempos estimados.

### Mototake Entregador

- APK privado distribuido fora da Play Store no primeiro lancamento.
- Login e cadastro/convite.
- Acesso somente com conta ativa e vinculo valido com empresa.
- Entregas disponiveis, aceite, entregas em andamento e sequencia de status.
- Empresas, perfil e historico existente.
- Bloqueio de acesso por empresa/plataforma.

### Mototake Loja

- Loja virtual por navegador.
- Link individual por empresa, por exemplo `/loja/pizzaria-central`.
- Cliente sem instalacao de aplicativo.
- Catalogo, carrinho, endereco, taxa, Pix, pedido e acompanhamento.
- Checkout visitante sem conta obrigatoria.

## Funcionalidades adiadas

- Play Store.
- Aplicativo nativo do cliente.
- Google Maps.
- Localizacao ao vivo.
- Rotas, geocodificacao e coordenadas.
- APIs pagas de endereco/mapa.
- WhatsApp API paga, SMS pago e chat.
- Programa de fidelidade.
- Avaliacoes.
- Cupons avancados.
- Split/subcontas de pagamento.

## Regras de custo

- O MVP nao depende de nenhuma API externa paga nova.
- O endereco sera preenchido pelo cliente em formulario.
- Caso exista consulta gratuita de CEP futuramente, ela deve ter fallback manual e nunca bloquear o pedido.
- Nao ha calculo geografico de distancia.

## Cliente web

- Pagina publica da empresa.
- Categorias e produtos.
- Carrinho persistido temporariamente no navegador.
- Nome, telefone, endereco, numero, complemento, referencia e observacoes.
- Retirada quando habilitada pela empresa.
- Metodo de pagamento.
- Taxa por bairro/regiao, taxa fixa futura ou bloqueio quando nao atendido.
- Confirmacao do pedido.
- Pagina publica de acompanhamento por token seguro.
- Previsao aproximada baseada nos tempos configurados pela empresa.

## Seguranca obrigatoria

- Backend e fonte da verdade para preco, estoque, taxa, subtotal e total.
- Cliente nao define status de pagamento.
- Cliente nao acessa dados administrativos.
- Slug publico nao concede acesso administrativo.
- Token de acompanhamento e aleatorio, longo, nao sequencial e limitado a um pedido.
- Dados sensiveis nao devem aparecer em logs, bundle ou URLs.

## Fora do escopo desta etapa

- Deploy em producao.
- Migration em producao.
- Publicacao na Play Store.
- Alteracao da branch `codex/mototake-auto-update`.
- Alteracao de Pix/Asaas em producao.
- Limpeza ou alteracao de dados reais.
