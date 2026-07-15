# Runbook de recuperacao de producao

Este documento descreve procedimentos seguros para recuperar ou estabilizar a producao durante o piloto.

Nao inclua secrets neste documento. Nao execute comandos destrutivos sem aprovacao explicita.

## 1. Identificar versao atual

```powershell
git fetch origin --tags
git log -1 --oneline
git tag --points-at HEAD
railway status
railway logs --service rotapronta-api
```

Baseline aprovado para piloto:

```text
v1.0.2-operational-qa
```

## 2. Validar saude

```powershell
curl.exe -i https://rotapronta-api-production.up.railway.app/api/health
curl.exe -i https://mototake-painel.netlify.app
```

Rotas privadas devem responder `401` sem token:

```powershell
curl.exe -i https://rotapronta-api-production.up.railway.app/api/sales
curl.exe -i https://rotapronta-api-production.up.railway.app/api/cash-registers
curl.exe -i https://rotapronta-api-production.up.railway.app/api/stock/products
```

## 3. Verificar migrations

No servico Railway correto:

```powershell
railway run --service rotapronta-api pnpm --filter @deliveries/backend prisma:deploy:prod
```

Esse comando deve aplicar apenas migrations pendentes. Nao usar reset.

## 4. Voltar para a tag de baseline

Procedimento conceitual:

1. Confirmar impacto de schema/migrations.
2. Confirmar que o rollback de codigo e compativel com o schema atual.
3. Fazer deploy manual do commit apontado por `v1.0.0-pilot-ready`.
4. Validar health.
5. Validar login e rotas privadas.

Nao usar `git reset --hard` em branch compartilhada.
Nao apagar migrations aplicadas sem plano de banco.

## 5. Redeploy de commit anterior

1. Identificar commit seguro.
2. Validar localmente.
3. Publicar de forma controlada no Railway.
4. Acompanhar logs.
5. Validar health e rotas protegidas.

## 6. Reverter Netlify

1. Abrir deploys do site oficial.
2. Selecionar deploy anterior aprovado.
3. Restaurar apenas se o backend correspondente for compativel.
4. Validar login em janela anonima.

## 7. Revogar sessoes de uma loja

Preferir usar desativacao operacional se a loja precisa parar:

```powershell
pnpm --filter @deliveries/backend pilot:deactivate:prod -- --store-id=<storeId>
```

Aplicacao real exige:

```powershell
$env:PILOT_ENV="production"
$env:PILOT_DEACTIVATE_CONFIRM="DEACTIVATE_PILOT_STORE"
pnpm --filter @deliveries/backend pilot:deactivate:prod -- --store-id=<storeId> --apply
```

## 8. Preservar dados antes de correcao

Antes de qualquer correcao em producao:

- Registrar commit atual.
- Registrar deploy Railway atual.
- Registrar deploy Netlify atual.
- Registrar storeId afetado.
- Registrar sintomas.
- Coletar logs sanitizados.
- Nao imprimir token, senha, chave Pix, segredo R2 ou DATABASE_URL.

## 9. Pix automatico

Durante o piloto controlado:

- `PAYMENT_GATEWAY_ENABLED` deve permanecer ausente ou `false`.
- `PAYMENT_GATEWAY_PROVIDER` deve permanecer ausente ou vazio.
- Webhook de pagamento real nao deve ser ativado sem fase propria.

## 10. RPO e RTO iniciais

Valores operacionais propostos ate ensaio formal:

- RPO alvo: ate 24 horas para banco se depender apenas de backup gerenciado diario; ajustar conforme plano Railway contratado.
- RTO alvo: ate 4 horas para restaurar API e painel em ambiente conhecido, assumindo acesso ao Railway/Netlify/GitHub.
- Storage R2: exigir versionamento ou procedimento equivalente antes de escala nacional.

Esses valores so devem ser considerados oficiais depois de um ensaio de restauracao em sandbox.

## 11. Ensaio de restauracao seguro

Nunca restaurar sobre producao.

Procedimento recomendado:

1. Criar banco Postgres isolado.
2. Restaurar snapshot/dump da producao ou amostra sanitizada.
3. Apontar servico sandbox temporario para o banco restaurado.
4. Rodar migrations pendentes apenas se o objetivo for validar upgrade.
5. Validar health, login de usuario teste sanitizado e rotas protegidas.
6. Descartar ambiente restaurado ao final.

Registrar:

- origem do backup;
- horario do backup;
- duracao da restauracao;
- falhas encontradas;
- RPO/RTO real medido;
- responsavel tecnico.

## 12. Rollback com migration

Antes de voltar codigo:

1. Verificar se migrations aplicadas sao backward-compatible.
2. Se a migration removeu coluna/tabela, parar e preparar plano especifico.
3. Preferir hotfix forward quando dados ja foram migrados.
4. Nunca executar `reset`, `truncate` ou rollback manual em producao sem backup recente e aprovacao explicita.
