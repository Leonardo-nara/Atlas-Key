# Monitoramento e alertas

## Checks ativos no repositorio

O workflow `.github/workflows/production-health.yml` executa a cada 30 minutos e valida:

- API producao: `https://rotapronta-api-production.up.railway.app/api/health`
- Readiness producao: `https://rotapronta-api-production.up.railway.app/api/health/readiness`
- Painel producao: `https://mototake-painel.netlify.app`
- API sandbox: `https://rotapronta-api-sandbox-production.up.railway.app/api/health`

Em falha, o workflow abre ou atualiza uma issue com os labels `incident` e `production-health`.

## Triagem inicial

1. Verificar a issue aberta pelo workflow.
2. Conferir o deploy atual no Railway e na Netlify.
3. Conferir logs do backend sem imprimir secrets.
4. Validar manualmente:

```powershell
curl.exe -i https://rotapronta-api-production.up.railway.app/api/health
curl.exe -i https://rotapronta-api-production.up.railway.app/api/health/readiness
curl.exe -i https://mototake-painel.netlify.app
curl.exe -i https://rotapronta-api-sandbox-production.up.railway.app/api/health
```

## Sinais que exigem prioridade alta

- API producao retorna 5xx.
- Banco indisponivel.
- Upload R2 indisponivel.
- Login falhando para todos os usuarios.
- Pedidos ou vendas falhando com 5xx.
- Vazamento entre lojas, clientes ou motoboys.

## Limites atuais

- Alertas por e-mail, Slack ou WhatsApp dependem de credenciais externas e ainda nao foram configurados.
- WebSocket multi-instancia exige Redis adapter ou estrategia equivalente antes de escalar replicas.
- Sentry deve permanecer habilitado com DSN de producao e filtros de dados sensiveis.

## Recuperacao

Use `docs/PRODUCTION_RECOVERY_RUNBOOK.md` para rollback, migracoes, sessao de loja e ensaio de restore.
