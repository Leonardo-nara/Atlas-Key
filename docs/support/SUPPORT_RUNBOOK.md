# Runbook de Suporte - Mototake

## Triagem inicial

1. Identificar ambiente: producao, sandbox ou demo.
2. Identificar perfil: empresa, cliente, motoboy ou admin.
3. Confirmar horario, tela, acao e mensagem de erro.
4. Coletar requestId quando existir.
5. Nao solicitar senha. Nunca registrar segredo.

## Checks rapidos

```powershell
curl.exe -i https://rotapronta-api-production.up.railway.app/api/health
curl.exe -i https://rotapronta-api-production.up.railway.app/api/health/readiness
```

## Rollback

Somente com decisao explicita. Usar backup/tag de release e validar banco antes de qualquer rollback.

