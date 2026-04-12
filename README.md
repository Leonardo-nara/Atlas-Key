# Delivery Platform Monorepo

Monorepo de um sistema de entregas com backend NestJS, desktop Electron para o lojista e mobile Expo para o motoboy. A base atual ja cobre autenticacao, produtos, pedidos, fluxo do courier, realtime, cancelamento e auditoria, e agora esta preparada para build, deploy e demonstracao comercial.

## Estrutura

```text
.
|- apps
|  |- backend
|  |- desktop
|  `- mobile
|- docs
|  `- RELEASE_CHECKLIST.md
|- packages
|  `- shared-types
|- .env.example
|- .env.production.example
|- docker-compose.yml
|- package.json
`- pnpm-workspace.yaml
```

## Stack

- `apps/backend`: NestJS + Prisma + PostgreSQL + JWT + Socket.IO
- `apps/desktop`: Electron + React + Vite + TypeScript
- `apps/mobile`: Expo React Native + TypeScript
- `packages/shared-types`: contratos compartilhados

## Pre-requisitos

- Node.js 20+
- pnpm 10+
- Docker + Docker Compose
- Para build mobile: conta Expo/EAS autenticada
- Para build desktop Windows: Windows com dependencias do Electron instaladas via `pnpm install`

## Ambiente

### Desenvolvimento local

1. Instale dependencias:

```bash
pnpm install
```

2. Copie o ambiente local:

```bash
cp .env.example .env
```

No PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Suba o banco:

```bash
docker compose up -d
```

4. Rode migrations, gere Prisma e seed:

```bash
pnpm --filter @deliveries/backend prisma:generate
pnpm --filter @deliveries/backend prisma:deploy
pnpm --filter @deliveries/backend prisma:seed
```

As referencias oficiais de ambiente estao em:

- [.env.example](C:\Users\x\OneDrive\Documentos\Playground\.env.example)
- [.env.production.example](C:\Users\x\OneDrive\Documentos\Playground\.env.production.example)
- [docs/ENVIRONMENTS.md](C:\Users\x\OneDrive\Documentos\Playground\docs\ENVIRONMENTS.md)

### Producao

Use [.env.production.example](C:\Users\x\OneDrive\Documentos\Playground\.env.production.example) como base. Os valores mais importantes sao:

- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ALLOWED_ORIGINS`
- `VITE_API_URL`
- `VITE_SOCKET_URL`
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SOCKET_URL`

Resumo das URLs:

- Local backend API: `http://localhost:3000/api`
- Local backend socket: `http://localhost:3000`
- Producao backend API: `https://rotapronta-api.onrender.com/api`
- Producao backend socket: `https://rotapronta-api.onrender.com`

Importante:

- o backend le variaveis em runtime
- o desktop usa `VITE_*` no momento do build do renderer
- o mobile usa `EXPO_PUBLIC_*` no momento do bundle/build
- `ELECTRON_RENDERER_URL` e apenas para desenvolvimento do desktop
- se `VITE_SOCKET_URL` ou `EXPO_PUBLIC_SOCKET_URL` nao forem informadas, os apps derivam o socket removendo `/api` da URL da API

## Rodando localmente

- Tudo em paralelo:

```bash
pnpm dev
```

- Backend:

```bash
pnpm dev:backend
```

- Desktop:

```bash
pnpm dev:desktop
```

- Mobile:

```bash
pnpm dev:mobile
```

## Backend em producao

O backend esta pronto para deploy em Railway, Render ou VPS, desde que o ambiente forneca `DATABASE_URL`, `JWT_SECRET` e as origens CORS corretas.

Guia recomendado para esta fase:

- [docs/RENDER_DEPLOY.md](C:\Users\x\OneDrive\Documentos\Playground\docs\RENDER_DEPLOY.md)

### Checklist de deploy do backend

1. Subir um PostgreSQL gerenciado ou proprio.
2. Configurar variaveis a partir de [.env.production.example](C:\Users\x\OneDrive\Documentos\Playground\.env.production.example).
3. Instalar dependencias:

```bash
pnpm install --frozen-lockfile
```

4. Gerar Prisma e aplicar migrations:

```bash
pnpm --filter @deliveries/backend prisma:generate
pnpm --filter @deliveries/backend prisma:deploy
pnpm --filter @deliveries/backend prisma:seed:prod
```

5. Buildar o backend:

```bash
pnpm --filter @deliveries/backend build
```

6. Subir em producao:

```bash
pnpm --filter @deliveries/backend start:prod
```

### Notas de operacao

- O backend faz bind em `HOST`, por padrao `0.0.0.0`.
- O CORS aceita a lista de `CORS_ALLOWED_ORIGINS` separada por virgula.
- O banco continua sendo Prisma + PostgreSQL, com migrations versionadas no repositorio.
- O seed de producao usa o `DATABASE_URL` presente no ambiente e pode ser executado com `pnpm --filter @deliveries/backend prisma:seed:prod`.
- Para Railway/Render, configure o start command como `pnpm --filter @deliveries/backend start:prod`.
- Para Render, use o checklist em [docs/RENDER_DEPLOY.md](C:\Users\x\OneDrive\Documentos\Playground\docs\RENDER_DEPLOY.md).
- Para VPS, recomenda-se rodar com PM2, systemd ou Docker.

## Build do desktop Windows

O desktop esta configurado com `electron-builder` e target NSIS para Windows.

### Gerar build

```bash
pnpm build:desktop
pnpm build:desktop:win
```

Ou diretamente:

```bash
pnpm --filter @deliveries/desktop dist:win
```

### Saida esperada

- Pasta de distribuicao: `apps/desktop/release`
- Instalador esperado: `delivery-platform-desktop-<version>-setup.exe`

### Variaveis importantes

- `VITE_API_URL`
- `VITE_SOCKET_URL`

Se o renderer nao usar o backend local, gere o build com essas variaveis apontando para o backend publicado antes de rodar `pnpm build:desktop:win`.

Exemplo no PowerShell:

```powershell
$env:VITE_API_URL="https://rotapronta-api.onrender.com/api"
$env:VITE_SOCKET_URL="https://rotapronta-api.onrender.com"
pnpm build:desktop:win
```

## Build mobile Android

O mobile esta preparado para Expo/EAS com perfis `preview` e `production`.

### Antes do build

1. Fazer login na Expo:

```bash
pnpm --filter @deliveries/mobile exec eas login
```

2. Ajustar [apps/mobile/app.json](C:\Users\x\OneDrive\Documentos\Playground\apps\mobile\app.json):
- substituir `extra.eas.projectId`
- revisar `android.package` se necessario

3. Validar a configuracao:

```bash
pnpm --filter @deliveries/mobile config:check
```

### Gerar build de teste

```bash
pnpm build:mobile:android:preview
```

### Gerar build de distribuicao

```bash
pnpm build:mobile:android:production
```

### Variaveis importantes

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SOCKET_URL`

Em dispositivo fisico, use um backend acessivel pela internet ou pela rede local. `localhost` nao funciona no celular.

Exemplo no PowerShell:

```powershell
$env:EXPO_PUBLIC_API_URL="https://rotapronta-api.onrender.com/api"
$env:EXPO_PUBLIC_SOCKET_URL="https://rotapronta-api.onrender.com"
pnpm build:mobile:android:production
```

## Alternando entre local e producao

### Backend

- Local: copie `.env.example` para `.env` e rode `pnpm dev:backend`
- Producao: configure a plataforma com os valores de `.env.production.example`

### Desktop

- Local: mantenha `VITE_API_URL=http://localhost:3000/api`
- Producao: defina `VITE_API_URL=https://rotapronta-api.onrender.com/api` e `VITE_SOCKET_URL=https://rotapronta-api.onrender.com` antes do build
- Teste rapido contra producao em desenvolvimento:

```powershell
$env:VITE_API_URL="https://rotapronta-api.onrender.com/api"
$env:VITE_SOCKET_URL="https://rotapronta-api.onrender.com"
pnpm dev:desktop
```

### Mobile

- Local: use `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_SOCKET_URL` apontando para o backend local ou para o IP da maquina
- Producao: defina `EXPO_PUBLIC_API_URL=https://rotapronta-api.onrender.com/api` e `EXPO_PUBLIC_SOCKET_URL=https://rotapronta-api.onrender.com` antes do bundle ou build EAS
- Teste rapido contra producao:

```powershell
$env:EXPO_PUBLIC_API_URL="https://rotapronta-api.onrender.com/api"
$env:EXPO_PUBLIC_SOCKET_URL="https://rotapronta-api.onrender.com"
pnpm dev:mobile
```

## Fluxo completo para demo

1. Suba backend, desktop e mobile.
2. Login no desktop com `STORE_ADMIN`.
3. Login no mobile com `COURIER`.
4. Crie um pedido no desktop.
5. Aceite o pedido no mobile.
6. Atualize para coletado e entregue no mobile.
7. Mostre o realtime refletindo no desktop.
8. Crie outro pedido e cancele no desktop.
9. Abra o historico do pedido cancelado no desktop.

## Credenciais seed

- `STORE_ADMIN`: `store-admin@example.com` / `StrongPass123`
- `COURIER 1`: `courier@example.com` / `StrongPass123`
- `COURIER 2`: `courier2@example.com` / `StrongPass123`

## Comandos principais

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm build:desktop:win
pnpm build:mobile:android:preview
pnpm build:mobile:android:production
```

## Release e piloto

Use o checklist em [docs/RELEASE_CHECKLIST.md](C:\Users\x\OneDrive\Documentos\Playground\docs\RELEASE_CHECKLIST.md) antes de demonstracoes, pilotos e entregas de teste.
