# Validacao Final do Sentry e Rotacao de Segredos

## Objetivo

Este guia fecha a operacao de observabilidade externa do backend e organiza a rotacao dos segredos que foram expostos fora do repositório.

## Pre-condicoes

- `SENTRY_DSN` configurado no backend do Render
- `OPERATIONAL_METRICS_TOKEN` configurado no backend do Render
- `ENABLE_SENTRY_TEST_ENDPOINT=false` por padrao
- backend publicado a partir da `main`

## Teste controlado do Sentry

1. No Render, habilite temporariamente:

```env
ENABLE_SENTRY_TEST_ENDPOINT=true
```

2. Aguarde o redeploy do backend ou force um deploy manual.

3. Dispare o teste protegido:

```bash
curl -X POST \
  -H "x-internal-metrics-token: <OPERATIONAL_METRICS_TOKEN>" \
  https://rotapronta-api.onrender.com/api/internal/sentry-test
```

4. Resultado esperado na API:

- status `500`
- `requestId` presente no corpo
- mensagem publica sanitizada

5. Resultado esperado no Sentry:

- evento novo no projeto do backend
- tags `request_id`, `http_method`, `http_path`, `http_status_code`
- contexto `request` com `requestId`, `method`, `path`, `statusCode`
- ausencia de `authorization`, `cookie`, `password`, `token`, `refreshToken`, `DATABASE_URL`, `JWT_SECRET`, `SENTRY_DSN`

6. Depois do teste, volte no Render:

```env
ENABLE_SENTRY_TEST_ENDPOINT=false
```

## Rotacao obrigatoria imediata

- `RENDER_API_KEY`
- `SENTRY_AUTH_TOKEN`
- `OPERATIONAL_METRICS_TOKEN`

## Rotacao recomendada em seguida

- `SENTRY_DSN`
- `JWT_SECRET`
- `DATABASE_URL`

## Ordem segura de rotacao

### 1. RENDER_API_KEY

- criar uma nova key no Render
- atualizar qualquer automacao local
- validar acesso
- revogar a key antiga

### 2. SENTRY_AUTH_TOKEN

- criar novo token com escopos minimos:
  - `org:read`
  - `project:read`
  - `event:read`
- atualizar uso operacional
- validar leitura
- revogar token antigo

### 3. OPERATIONAL_METRICS_TOKEN

- gerar novo valor forte e aleatorio
- atualizar no Render
- validar `/api/internal/metrics`
- revogar o valor antigo

### 4. SENTRY_DSN

- gerar nova client key no projeto Sentry, se quiser invalidar totalmente a anterior
- atualizar no Render
- redeployar backend
- validar novo evento
- revogar a client key anterior

### 5. JWT_SECRET

- trocar apenas em janela controlada
- isso invalida access tokens ainda ativos
- refresh tokens continuam dependendo da sessao no banco, mas o fluxo de autenticacao vai reemitir tokens novos
- planejar comunicacao interna se houver usuarios ativos

### 6. DATABASE_URL

- so rotacione junto com o provedor do Postgres e em janela controlada
- atualizar Render
- validar boot do backend, Prisma e queries principais

## Observacoes

- `client_id` do Google OAuth nao e segredo
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` nao exige rotacao por exposicao em cliente
- placeholders de `.env.example` e `.env.production.example` estao corretos e nao carregam segredos reais
