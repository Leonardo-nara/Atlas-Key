# Checklist de Release e Piloto

## Antes da release

- Confirmar `DATABASE_URL`, `JWT_SECRET` e `CORS_ALLOWED_ORIGINS` do ambiente alvo.
- Rodar `pnpm install`.
- Rodar `pnpm --filter @deliveries/backend prisma:deploy`.
- Rodar `pnpm --filter @deliveries/backend prisma:generate`.
- Validar `pnpm --filter @deliveries/backend build`.
- Validar `pnpm --filter @deliveries/desktop build`.
- Validar `pnpm --filter @deliveries/mobile build`.

## Backend

- Subir o backend em modo producao com `pnpm --filter @deliveries/backend start:prod`.
- Conferir `GET /api/health`.
- Testar login de `STORE_ADMIN`.
- Testar login de `COURIER`.
- Testar criacao, aceite, atualizacao de status e cancelamento de pedido.

## Desktop

- Gerar pacote com `pnpm --filter @deliveries/desktop dist:win`.
- Instalar o `.exe` gerado em `apps/desktop/release`.
- Abrir o app instalado e validar login, produtos, pedidos e historico.

## Mobile

- Validar `pnpm --filter @deliveries/mobile config:check`.
- Gerar build com `pnpm --filter @deliveries/mobile build:android:preview`.
- Instalar o APK no dispositivo Android de teste.
- Confirmar que `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_SOCKET_URL` apontam para um backend acessivel pelo celular.

## Credenciais seed

- `STORE_ADMIN`: `store-admin@example.com` / `StrongPass123`
- `COURIER 1`: `courier@example.com` / `StrongPass123`
- `COURIER 2`: `courier2@example.com` / `StrongPass123`

## Fluxo minimo para demo

- Login no desktop com `STORE_ADMIN`.
- Login no mobile com `COURIER`.
- Criar pedido no desktop.
- Aceitar no mobile.
- Atualizar para coletado.
- Atualizar para entregue.
- Criar outro pedido e cancelar no desktop.
- Mostrar historico do pedido no desktop.
