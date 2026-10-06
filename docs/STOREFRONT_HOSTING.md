# Loja Online compartilhada

Um unico storefront atende todas as empresas por `/loja/{slug}`. O backend
resolve o slug e filtra produtos publicados pela loja. Ativar uma loja ou
publicar produtos nao exige novo site nem novo deploy. O acompanhamento usa
`/pedido/{trackingToken}`; o cliente nao precisa de conta.

## Configuracao preparada, sem publicar

- Manter o `netlify.toml` da raiz: ele pertence ao painel desktop.
- Para o site do storefront, selecionar o package/base `apps/storefront` e
  sua configuracao `apps/storefront/netlify.toml`. Publicacao: `dist`;
  comando: `pnpm --filter @deliveries/storefront build`.
- `VITE_STORE_API_URL=https://rotapronta-api-production.up.railway.app/api`.
- No build desktop, `VITE_STOREFRONT_URL=https://pedido.mototake.com.br`
  (ja e o fallback de producao). Nao usar a URL do painel como storefront.
- O redirect SPA ja existe tambem em `apps/storefront/public/_redirects`.
- Associar `pedido.mototake.com.br` ao site do storefront existente, se houver.
  Para DNS externo, configurar CNAME `pedido` para o hostname `.netlify.app`
  exato desse site, fornecido pelo painel Netlify, e validar HTTPS. Nao usar
  hostname inventado nem apontar para o painel desktop.
- CORS deve incluir exatamente `https://pedido.mototake.com.br`. A consulta
  somente leitura de 06/10/2026 confirmou esse header na API oficial.

Nenhum site, plano, registro DNS ou deploy foi criado por esta preparacao.
O dominio nao resolveu na consulta local desta rodada; confirmar o site alvo
e DNS antes de distribuir links. Usar recursos existentes, sem contratar plano.

Pix automatico permanece opcional e somente sandbox; producao deve manter
`PAYMENT_GATEWAY_ENABLED=false`. Dinheiro, debito/credito na entrega e Pix
manual nao dependem de disponibilidade do Asaas.
