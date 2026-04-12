# Deploy do Backend no Render

Este guia prepara o backend do RotaPronta para subir no Render com PostgreSQL de producao e Prisma.

## 1. Criar o banco

1. No Render, crie um PostgreSQL.
2. Copie a `Internal Database URL` ou a `External Database URL`.
3. Use essa URL em `DATABASE_URL`.

## 2. Criar o servico web

1. No Render, clique em `New +`.
2. Escolha `Web Service`.
3. Conecte o repositorio do monorepo.
4. Selecione o plano desejado.

## 3. Configuracao recomendada do servico

- Root Directory: deixe vazio se o Render vai buildar a raiz do monorepo
- Environment: `Node`
- Build Command:

```bash
pnpm install --frozen-lockfile && pnpm --filter @deliveries/backend prisma:deploy:prod && pnpm --filter @deliveries/backend build:prod
```

- Start Command:

```bash
pnpm --filter @deliveries/backend start:prod
```

## 4. Variaveis de ambiente obrigatorias

- `NODE_ENV=production`
- `PORT=3000`
- `HOST=0.0.0.0`
- `API_PREFIX=api`
- `DATABASE_URL=<url-do-postgres-de-producao>`
- `JWT_SECRET=<segredo-forte-e-longo>`
- `JWT_EXPIRES_IN=7d`
- `CORS_ALLOWED_ORIGINS=https://painel.rotapronta.com,https://app.rotapronta.com`
- Se desktop e mobile publicados forem consumir este backend, use neles:
  - `VITE_API_URL=https://rotapronta-api.onrender.com/api`
  - `VITE_SOCKET_URL=https://rotapronta-api.onrender.com`
  - `EXPO_PUBLIC_API_URL=https://rotapronta-api.onrender.com/api`
  - `EXPO_PUBLIC_SOCKET_URL=https://rotapronta-api.onrender.com`

## 5. Como o Prisma roda em producao

No Render, o fluxo recomendado fica assim:

1. `prisma migrate deploy`
2. `prisma generate`
3. `node prisma/seed.js`
4. `nest build`
5. `node dist/main.js`

Os scripts locais com `dotenv -e ../../.env` continuam existindo apenas para desenvolvimento.

## 6. Rodar seed no banco de producao

Se voce abrir um Shell no servico do Render, o `DATABASE_URL` de producao ja estara presente no ambiente. Rode:

```bash
pnpm --filter @deliveries/backend prisma:seed:prod
```

Se preferir rodar da sua maquina apontando manualmente para o banco do Render, no PowerShell:

```powershell
$env:DATABASE_URL="<DATABASE_URL_DO_RENDER>"
pnpm --filter @deliveries/backend prisma:seed:prod
```

O seed e idempotente para os usuarios principais porque usa `upsert`, e remove apenas pedidos/produtos marcados como seed antes de recria-los.

## 7. Healthcheck online

Depois do deploy, valide:

```text
GET https://SEU-BACKEND.onrender.com/api/health
```

Resposta esperada:

```json
{
  "service": "backend",
  "status": "ok"
}
```

## 8. Checklist fechado de deploy no Render

1. Banco PostgreSQL criado no Render
2. `DATABASE_URL` preenchida com a URL correta
3. `JWT_SECRET` configurado
4. `CORS_ALLOWED_ORIGINS` configurado com os dominios reais
5. Build Command configurado
6. Seed executado com `pnpm --filter @deliveries/backend prisma:seed:prod`
7. Start Command configurado
8. Deploy concluido sem erro de migration
9. `GET /api/health` respondendo `200`
10. `POST /api/auth/login` respondendo online
11. Desktop e mobile apontando para a URL publica depois do backend online
