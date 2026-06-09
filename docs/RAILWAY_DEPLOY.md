# Deploy do Backend no Railway

Este guia prepara o backend do RotaPronta/Mototake para rodar no Railway com PostgreSQL, Prisma e storage Cloudflare R2/S3. O fluxo nao depende do Render.

## 1. Criar o projeto

1. Acesse o Railway e crie um novo projeto.
2. Conecte o repositorio GitHub do monorepo.
3. Adicione um servico para o backend usando o repositorio.
4. Adicione um banco `PostgreSQL` no mesmo projeto.

## 2. Configurar o servico backend

Use a raiz do monorepo como root do deploy.

Build command:

```bash
pnpm install --frozen-lockfile && pnpm --filter @deliveries/backend build:prod
```

Start command:

```bash
pnpm --filter @deliveries/backend start:prod
```

O `start:prod` executa `prisma migrate deploy` antes de iniciar o NestJS. Se preferir separar migrations manualmente, use o start alternativo:

```bash
pnpm --filter @deliveries/backend start
```

Nesse caso rode migrations pelo terminal do Railway antes do start/deploy:

```bash
pnpm --filter @deliveries/backend prisma:deploy:prod
```

## 3. Banco PostgreSQL

No Railway, copie a variavel `DATABASE_URL` gerada pelo plugin PostgreSQL e deixe disponivel para o servico backend.

Regras:

- Use a `DATABASE_URL` do Railway, nao a URL antiga do Render.
- Nao rode `prisma migrate reset` em producao.
- Para aplicar migrations de producao, use apenas:

```bash
pnpm --filter @deliveries/backend prisma:deploy:prod
```

## 4. Variaveis obrigatorias do backend

Configure no servico backend do Railway:

```env
NODE_ENV=production
HOST=0.0.0.0
API_PREFIX=api
DATABASE_URL=<DATABASE_URL_DO_POSTGRES_RAILWAY>
JWT_SECRET=<segredo-forte-com-32-ou-mais-caracteres>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_DAYS=30
CORS_ALLOWED_ORIGINS=<origens-reais-separadas-por-virgula>
```

Observacao sobre `PORT`: o Railway injeta `PORT` automaticamente. Nao fixe um valor se a plataforma ja fornecer essa env.

## 5. Storage Cloudflare R2/S3

O filesystem local do Railway nao deve ser usado para arquivos persistentes. Configure R2/S3 para comprovantes Pix e imagens.

Comprovantes Pix:

```env
PAYMENT_PROOF_STORAGE_DRIVER=s3
PAYMENT_PROOF_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
PAYMENT_PROOF_S3_REGION=auto
PAYMENT_PROOF_S3_BUCKET=rotapronta-payment-proofs
PAYMENT_PROOF_S3_ACCESS_KEY_ID=<r2-access-key-id>
PAYMENT_PROOF_S3_SECRET_ACCESS_KEY=<r2-secret-access-key>
PAYMENT_PROOF_S3_FORCE_PATH_STYLE=true
```

Imagens de loja, produtos e motoboy:

```env
IMAGE_STORAGE_DRIVER=s3
IMAGE_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
IMAGE_S3_REGION=auto
IMAGE_S3_BUCKET=rotapronta-images
IMAGE_S3_ACCESS_KEY_ID=<r2-access-key-id>
IMAGE_S3_SECRET_ACCESS_KEY=<r2-secret-access-key>
IMAGE_S3_FORCE_PATH_STYLE=true
```

Se quiser reutilizar o mesmo bucket/credenciais dos comprovantes, deixe as envs `IMAGE_S3_*` vazias e mantenha `IMAGE_STORAGE_DRIVER=s3`; o backend usa fallback para `PAYMENT_PROOF_*` quando configurado assim.

## 6. Observabilidade e rotas internas

O Sentry continua opcional:

```env
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=rotapronta-backend
SENTRY_TRACES_SAMPLE_RATE=0
ENABLE_SENTRY_TEST_ENDPOINT=false
```

Metricas internas:

```env
OPERATIONAL_METRICS_TOKEN=<segredo-forte>
```

## 7. Criar o primeiro PLATFORM_ADMIN

Depois do deploy e das migrations, abra o terminal/shell do servico backend no Railway e configure temporariamente:

```bash
export PLATFORM_ADMIN_EMAIL="seu-email-admin"
export PLATFORM_ADMIN_NAME="Seu nome"
export PLATFORM_ADMIN_PASSWORD="sua-senha-forte"
pnpm --filter @deliveries/backend admin:create:prod
```

O script nao imprime a senha. Se o usuario ja existir com outra role, ele avisa e nao promove automaticamente sem configuracao explicita.

Para resetar a senha de um admin existente:

```bash
export PLATFORM_ADMIN_EMAIL="seu-email-admin"
export PLATFORM_ADMIN_PASSWORD="nova-senha-forte"
pnpm --filter @deliveries/backend admin:reset-password:prod
```

## 8. Validar backend online

Depois do deploy:

```text
GET https://<seu-servico>.up.railway.app/api/health
```

Resposta esperada:

```json
{
  "service": "backend",
  "status": "ok"
}
```

Valide tambem:

- login do `PLATFORM_ADMIN`
- listagem admin de empresas
- criacao/login de loja
- catalogo publico
- upload de imagem/comprovante usando R2

## 9. Apontar desktop para a nova API

Antes de gerar o instalador desktop, defina:

```powershell
$env:VITE_API_URL="https://<seu-servico>.up.railway.app/api"
$env:VITE_SOCKET_URL="https://<seu-servico>.up.railway.app"
pnpm build:desktop:win
```

O desktop ja instalado com URL antiga precisa ser reinstalado/rebuildado para usar a nova API, porque essas envs entram no build do Vite.

## 10. Apontar mobile para a nova API

Antes do build Expo/EAS:

```powershell
$env:EXPO_PUBLIC_API_URL="https://<seu-servico>.up.railway.app/api"
$env:EXPO_PUBLIC_SOCKET_URL="https://<seu-servico>.up.railway.app"
pnpm build:mobile:android:production
```

Se usar EAS env, configure as mesmas variaveis no ambiente `production`.

## 11. Checklist final Railway

1. Projeto Railway criado.
2. Repositorio GitHub conectado.
3. PostgreSQL criado no Railway.
4. `DATABASE_URL` do Railway vinculada ao backend.
5. Build command configurado.
6. Start command configurado.
7. `JWT_SECRET` forte configurado.
8. `CORS_ALLOWED_ORIGINS` configurado com origens reais.
9. Cloudflare R2 configurado para comprovantes e imagens.
10. Deploy concluiu sem erro de migration.
11. `/api/health` responde `200`.
12. `PLATFORM_ADMIN` criado pelo shell do Railway.
13. Desktop/mobile rebuildados apontando para a nova API.

## 12. Se o banco antigo foi perdido

Se a conta/projeto Render e o banco antigo foram perdidos, considere os dados antigos indisponiveis ate existir backup/exportacao.

Impactos:

- usuarios antigos precisarao ser recriados;
- empresas, produtos, pedidos, taxas, Pix manual e auditoria antiga nao voltam sem backup;
- arquivos no R2 continuam existindo, mas registros do banco que apontavam para eles podem ter sido perdidos;
- comece com novo `PLATFORM_ADMIN`, recrie empresas e produtos, e valide o fluxo completo antes do piloto.

Nao tente reutilizar dados parciais manualmente sem conferir integridade de usuarios, lojas, pedidos e chaves de storage.
