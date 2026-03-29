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

## 5. Como o Prisma roda em producao

No Render, o fluxo recomendado fica assim:

1. `prisma migrate deploy`
2. `prisma generate`
3. `nest build`
4. `node dist/main.js`

Os scripts locais com `dotenv -e ../../.env` continuam existindo apenas para desenvolvimento.

## 6. Healthcheck online

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

## 7. Checklist fechado de deploy no Render

1. Banco PostgreSQL criado no Render
2. `DATABASE_URL` preenchida com a URL correta
3. `JWT_SECRET` configurado
4. `CORS_ALLOWED_ORIGINS` configurado com os dominios reais
5. Build Command configurado
6. Start Command configurado
7. Deploy concluido sem erro de migration
8. `GET /api/health` respondendo `200`
9. `POST /api/auth/login` respondendo online
10. Desktop e mobile apontando para a URL publica depois do backend online
