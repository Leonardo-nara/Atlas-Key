# Ambientes do RotaPronta

Este projeto usa duas referencias principais de ambiente na raiz:

- `.env.example`: base para desenvolvimento local
- `.env.production.example`: base para deploy e builds de producao

## Quem consome cada variavel

### Backend

Consumidas em runtime pelo NestJS:

- `NODE_ENV`
- `PORT`
- `HOST`
- `API_PREFIX`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ALLOWED_ORIGINS`
- `CORS_ORIGIN_DESKTOP`
- `CORS_ORIGIN_MOBILE`
- `PAYMENT_PROOF_STORAGE_DRIVER`
- `PAYMENT_PROOF_STORAGE_DIR`
- `PAYMENT_PROOF_S3_ENDPOINT`
- `PAYMENT_PROOF_S3_REGION`
- `PAYMENT_PROOF_S3_BUCKET`
- `PAYMENT_PROOF_S3_ACCESS_KEY_ID`
- `PAYMENT_PROOF_S3_SECRET_ACCESS_KEY`
- `PAYMENT_PROOF_S3_FORCE_PATH_STYLE`

### Desktop

Consumidas no build do renderer Vite:

- `VITE_API_URL`
- `VITE_SOCKET_URL`

Consumida apenas em desenvolvimento do Electron:

- `ELECTRON_RENDERER_URL`

### Mobile

Consumidas no bundle do Expo:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SOCKET_URL`

## Matriz de URLs

### Desenvolvimento local

- Backend API: `http://localhost:3000/api`
- Backend Socket: `http://localhost:3000`
- Desktop renderer dev: `http://localhost:5173`
- Mobile em celular fisico: usar o IP da maquina no lugar de `localhost`

### Producao

- Backend API: `https://rotapronta-api.onrender.com/api`
- Backend Socket: `https://rotapronta-api.onrender.com`
- Desktop build: usa `VITE_API_URL` e `VITE_SOCKET_URL` no momento do build
- Mobile build: usa `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_SOCKET_URL` no momento do build
- Se `VITE_SOCKET_URL` ou `EXPO_PUBLIC_SOCKET_URL` nao forem informadas, desktop e mobile derivam o socket removendo `/api` da URL da API

## Como alternar entre local e producao

### Backend local

1. Copie `.env.example` para `.env`
2. Mantenha `PAYMENT_PROOF_STORAGE_DRIVER=local`
3. Opcionalmente ajuste `PAYMENT_PROOF_STORAGE_DIR`
4. Rode o backend com `pnpm dev:backend`

### Backend em producao

1. Use os valores de `.env.production.example` na plataforma de deploy
2. Para comprovantes Pix, prefira `PAYMENT_PROOF_STORAGE_DRIVER=s3` com Cloudflare R2/S3
3. Rode migrations Prisma
4. Rode `pnpm --filter @deliveries/backend build`
5. Suba com `pnpm --filter @deliveries/backend start:prod`

### Storage de comprovantes Pix

Em desenvolvimento, o backend salva comprovantes no filesystem local:

```env
PAYMENT_PROOF_STORAGE_DRIVER=local
PAYMENT_PROOF_STORAGE_DIR=./storage/payment-proofs
```

Em producao no Render, filesystem local pode ser perdido em restart/deploy se nao houver disco persistente. Para producao real, use storage S3-compativel, preferencialmente Cloudflare R2:

```env
PAYMENT_PROOF_STORAGE_DRIVER=s3
PAYMENT_PROOF_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
PAYMENT_PROOF_S3_REGION=auto
PAYMENT_PROOF_S3_BUCKET=rotapronta-payment-proofs
PAYMENT_PROOF_S3_ACCESS_KEY_ID=<r2-access-key-id>
PAYMENT_PROOF_S3_SECRET_ACCESS_KEY=<r2-secret-access-key>
PAYMENT_PROOF_S3_FORCE_PATH_STYLE=true
```

O backend continua servindo os arquivos por endpoint autenticado e nao expoe bucket, URL publica, path local ou segredo.

### Build desktop para producao

Antes do build do desktop, defina:

- `VITE_API_URL`
- `VITE_SOCKET_URL`

No PowerShell:

```powershell
$env:VITE_API_URL="https://rotapronta-api.onrender.com/api"
$env:VITE_SOCKET_URL="https://rotapronta-api.onrender.com"
pnpm build:desktop:win
```

Depois rode:

- `pnpm build:desktop:win`

### Build mobile para producao

Antes do build do mobile, defina:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SOCKET_URL`

No PowerShell:

```powershell
$env:EXPO_PUBLIC_API_URL="https://rotapronta-api.onrender.com/api"
$env:EXPO_PUBLIC_SOCKET_URL="https://rotapronta-api.onrender.com"
pnpm build:mobile:android:production
```

Depois rode:

- `pnpm build:mobile:android:production`
