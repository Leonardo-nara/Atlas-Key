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

- Backend API: `https://api.rotapronta.com/api`
- Backend Socket: `https://api.rotapronta.com`
- Desktop build: usa `VITE_API_URL` e `VITE_SOCKET_URL` no momento do build
- Mobile build: usa `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_SOCKET_URL` no momento do build

## Como alternar entre local e producao

### Backend local

1. Copie `.env.example` para `.env`
2. Rode o backend com `pnpm dev:backend`

### Backend em producao

1. Use os valores de `.env.production.example` na plataforma de deploy
2. Rode migrations Prisma
3. Rode `pnpm --filter @deliveries/backend build`
4. Suba com `pnpm --filter @deliveries/backend start:prod`

### Build desktop para producao

Antes do build do desktop, defina:

- `VITE_API_URL`
- `VITE_SOCKET_URL`

Depois rode:

- `pnpm build:desktop:win`

### Build mobile para producao

Antes do build do mobile, defina:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SOCKET_URL`

Depois rode:

- `pnpm build:mobile:android:production`
