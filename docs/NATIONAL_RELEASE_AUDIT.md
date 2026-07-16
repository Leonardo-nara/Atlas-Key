# Auditoria mestre para preparacao nacional do Mototake

Data: 2026-07-15

Escopo: auditoria tecnica de backend, painel web/desktop, mobile, infraestrutura, seguranca, LGPD, publicacao, recuperacao e operacao nacional. Este documento nao e parecer juridico.

## Resultado geral

Classificacao atual: **PRONTO PARA PILOTO REAL CONTROLADO**.

Classificacao para lancamento nacional: **AINDA NAO PRONTO**.

Motivo: os fluxos operacionais principais foram aprovados em sandbox e a suite QA operacional foi integrada, mas ainda faltam controles formais para operacao nacional: branch protection verificada no GitHub, pipeline obrigatorio ativo, backup/restore ensaiado, push notification real, build mobile release distribuivel validado fora do Expo Go, politica LGPD revisada juridicamente, plano de suporte nacional e estrategia de escala horizontal para WebSocket.

## Arquitetura e fluxo de dados

```text
Cliente/Motoboy Expo Android
  -> HTTPS API Railway /api
  -> WebSocket Railway
  -> Postgres Railway
  -> R2/S3 para imagens e comprovantes

Painel web Netlify / Electron Desktop
  -> HTTPS API Railway /api
  -> WebSocket Railway
  -> Postgres Railway
  -> R2/S3 para imagens e comprovantes

Backend NestJS
  -> Prisma/Postgres
  -> Sentry opcional
  -> Cloudflare R2 via S3 SDK
  -> Asaas sandbox implementado atras de feature flag
```

## Inventario

| Componente | Existe | Estado | Ambiente | Bloqueios |
| --- | --- | --- | --- | --- |
| Backend NestJS | Sim | Funcional e testado | Railway producao e sandbox | Confirmar branch protection e backups restauraveis |
| Prisma/Postgres | Sim | Migrations aplicadas | Railway Postgres | Ensaio de restore isolado pendente |
| Painel web | Sim | Publicado em Netlify | Producao | CI obrigatorio e politicas de deploy precisam ser protegidos |
| Electron desktop | Sim | Build Windows existente | Local/distribuivel | Assinatura de codigo e atualizador automatico pendentes |
| Mobile cliente Android | Sim, no app compartilhado | Funcional | Expo/EAS | Build release final, loja e testes release pendentes |
| Mobile motoboy Android | Sim, no app compartilhado | Funcional | Expo/EAS | Build release final, loja e testes release pendentes |
| iOS cliente/motoboy | Parcial via Expo config | Nao validado | Requer Apple | Conta Apple, certificados, TestFlight e revisao pendentes |
| App empresa mobile | Nao separado | Painel web atende empresa | Web | Avaliar PWA/tablet no piloto |
| WebSocket | Sim | Funcional em uma instancia | Railway | Redis adapter ou equivalente para escala horizontal |
| Notificacoes push | Nao | Apenas realtime in-app | N/A | Bloqueador para operacao nacional com app em segundo plano |
| Storage R2/S3 | Sim | Implementado | Cloudflare R2 | Confirmar versionamento/retencao e restauracao de objetos |
| Pix manual | Sim | Funcional | Producao | Politicas de conferencIa e suporte |
| Pix automatico Asaas | Parcial | Sandbox validado atras de flag | Sandbox | Nao ativar producao sem plano financeiro/webhook/suporte |
| Observabilidade | Parcial | Logs estruturados, Sentry opcional | Railway/Sentry | Alertas operacionais e dashboard externo pendentes |

## Seguranca

| Area | Severidade | Problema | Correcao | Status |
| --- | --- | --- | --- | --- |
| CI/CD | Alta | Nao havia `.github` com pipeline obrigatorio | Adicionado workflow CI, CODEOWNERS e template de PR | Corrigido na branch |
| Repositorio | Alta | Protecao da `main`, PR obrigatorio e 2FA nao sao verificaveis localmente | Exigir configuracao no GitHub | Pendente externo |
| WebSocket | Alta | Escala horizontal depende de memoria local da instancia | Planejar Redis adapter antes de multiplas replicas | Pendente |
| Notificacoes | Alta | Sem push real para app em background | Implementar Expo/FCM/APNs com isolamento por usuario/loja | Pendente |
| Backup/restore | Alta | Restore nao ensaiado em ambiente isolado nesta rodada | Rodar ensaio com dump/snapshot em sandbox | Pendente |
| Auth | Media | MFA para PLATFORM_ADMIN/STORE_ADMIN ausente | Planejar MFA com provider de e-mail/app autenticador | Pendente |
| Desktop token storage | Media | Painel web usa `localStorage`; XSS teria impacto em tokens | Manter CSP, revisar XSS, avaliar cookie httpOnly/BFF no futuro | Pendente |
| CORS `file://`/`null` | Media | Necessario para Electron, mas amplo para web | Documentar e avaliar build web separado sem origem nula | Pendente |
| Uploads | Media | Validacao por assinatura basica, sem antivirus/CDR | Manter tipos restritos; avaliar scanner assIncrono se risco aumentar | Aceito para piloto |
| Logs | Media | Retencao formal nao definida | Definir retencao e processo LGPD | Pendente |

## Backend

- Framework: NestJS 11.
- Banco: PostgreSQL via Prisma 6.
- Auth: JWT access token, refresh token rotativo com hash em banco, logout e revogacao de sessoes.
- Rate limiting: global `@nestjs/throttler`, limites especificos em auth.
- Validacao: `ValidationPipe` global com `whitelist`, `transform` e `forbidNonWhitelisted`.
- Headers: Helmet ativo, sem `x-powered-by`, CSP desativada no backend por nao servir UI.
- Storage: driver local e S3/R2 para comprovantes e imagens; arquivos privados servidos por endpoints autenticados.
- Realtime: Socket.IO autenticado por JWT e rooms por loja/cliente/motoboy.
- Observabilidade: requestId, logs estruturados, filtro global, Sentry opcional.

## Painel web e desktop

- Framework: React 19 + Vite; Electron para desktop Windows.
- Painel web oficial: Netlify com redirect SPA.
- Tokens: access/refresh no `localStorage`.
- Rotas: hash router, guard por role.
- Permissoes: STORE_ADMIN e PLATFORM_ADMIN separados no frontend e backend.
- Responsividade: aprovada em smoke Playwright da fase QA operacional; ampliar para matriz de tablets/celulares se a empresa usar web mobile.

## Aplicativos

- Projeto mobile unico: `apps/mobile`, Expo SDK 53, React Native 0.79.
- Android package atual: `com.souzaworks.mototake`.
- App name atual: `Mototake`.
- Versao: `0.1.0`, `versionCode=1`.
- Build production EAS: app-bundle com API Railway.
- iOS: plataforma suportada pelo Expo, mas sem bundle ID/certificados/build validado.
- Permissoes Android declaradas: nenhuma permissao adicional no `app.json`; image/document pickers podem solicitar permissao em runtime quando usados.
- Notificacoes push: nao implementadas.
- Localizacao/mapa: provedor real nao identificado no codigo atual.

## Brasil

| Tema | Estado | Risco | Proxima acao |
| --- | --- | --- | --- |
| Timezone | Relatorios retornam timezone e seed usa Sao Paulo; loja ainda nao tem timezone operacional robusto | Alto para operacao nacional | Modelar timezone por loja e migrar relatorios/caixa para timezone da loja |
| CEP/endereco | Campos estruturados existem; sem validacao nacional de CEP/UF/coordenadas | Medio | Padronizar UF, CEP e endereco rural/sem numero |
| Taxa por bairro | Funcional por texto normalizado | Medio | Evitar erro com bairros homonimos; avaliar CEP/regiao geocodificada |
| Telefone | Campo texto | Medio | Normalizar E.164 Brasil e validar DDD |
| Moeda | Decimal no backend e BRL na UI | Baixo | Manter Decimal; evitar float em calculos novos |
| Mapas | Nao identificado | Medio | Escolher provedor e estimar custo antes de rotas/distancia |

## Infraestrutura

- Railway backend com healthcheck `/api/health`.
- Railway Postgres.
- Netlify para painel web.
- Cloudflare R2 para storage.
- Gateway Asaas sandbox atras de flags; producao desligada.
- RPO/RTO formais: pendentes de confirmacao externa.
- Escala horizontal: backend HTTP pode escalar; WebSocket precisa adapter compartilhado antes de multiplas replicas.

## CI/CD e repositorio

Implementado nesta branch:

- `.github/workflows/ci.yml`
- `.github/CODEOWNERS`
- `.github/pull_request_template.md`

Ainda precisa configurar no GitHub:

- Branch protection da `main`.
- PR obrigatorio.
- Status check `CI / Validate monorepo` obrigatorio.
- Bloqueio de force push.
- Secret scanning e Dependabot/security updates.
- Tags protegidas para `v*`.

## LGPD

Resumo tecnico: o sistema trata nome, e-mail, telefone, endereco, historico de pedidos, comprovantes Pix, logs tecnicos, dados de motoboy e dados operacionais de loja. Ver `docs/LGPD_TECHNICAL_AUDIT.md`.

Todos os documentos publicos exigem: **REQUER REVISAO JURIDICA PROFISSIONAL**.

## Testes executaveis

- Backend unit/smoke/security.
- E2E real de ownership.
- QA operacional full sandbox.
- Playwright web temporario usado na fase anterior.
- Mobile typecheck/lint/build/config.

Lacunas:

- Testes release Android automatizados recorrentes.
- Testes iOS.
- Teste de carga sistematico.
- Teste de restore.
- Teste WebSocket multi-instancia.

## Pendencias

## Atualizacao da rodada de fechamento tecnico

Implementado nesta rodada:

- Timezone por loja no banco, com default/backfill `America/Sao_Paulo`.
- Relatorios, CSVs e dashboard da loja usando timezone da loja.
- Campo de timezone na criacao de empresa pelo painel admin.
- Readiness tecnico em `/api/health/readiness` com verificacao de banco e configuracao de storage sem expor secrets.
- Workflow agendado de health publico com abertura/atualizacao de issue de incidente.
- CI com validacao de migrations e audit de dependencias tolerante ao endpoint npm legado 410.
- Script de smoke/carga seguro para sandbox, recusando label de producao.
- Preparacao iOS minima no Expo config.
- `.easignore` reforcado para reduzir contexto de build Android/EAS.
- Modelos tecnicos LGPD/termos marcados para revisao juridica.

Validado nesta rodada:

- Backend unit/smoke/security: 68/68.
- Backend typecheck/lint/build.
- Desktop typecheck/lint/build.
- Mobile typecheck/lint/build/config.
- Health producao, health sandbox e painel producao retornando 200.
- Smoke/carga leve no sandbox sem 5xx.

Nao concluido por dependencia externa/ambiente:

- Branch protection real da `main`: requer permissao GitHub admin; `gh` nao esta instalado e a integracao disponivel nao expõe regras.
- E2E real local: Docker Desktop/Postgres local indisponivel no ambiente.
- Build Android EAS release: depende de nova execucao EAS/cloud; a rodada anterior travou em compress/upload e esta rodada apenas reduziu o contexto.
- Push notification real: depende de credenciais/permissoes FCM/APNs/Expo e teste em dispositivo release.
- iOS/TestFlight: depende de conta Apple Developer e credenciais.
- WebSocket multi-instancia: depende de Redis ou servico equivalente antes de escalar replicas.
- Restore real de backup gerenciado Railway/R2: depende de acesso/snapshot/ambiente temporario externo.

### Bloqueadores do piloto real

1. Configurar GitHub branch protection e CI obrigatorio.
2. Confirmar backup Railway/Postgres e procedimento de restore.
3. Definir suporte operacional e responsavel por incidentes.
4. Validar build Android release fora do Expo Go em aparelho real.

### Bloqueadores do lancamento nacional

1. Push notifications Android/iOS.
2. Timezone por loja implementado nesta branch; ainda requer deploy sandbox/producao e validacao operacional controlada.
3. Politica LGPD/termos revisados juridicamente.
4. Publicacao Google Play e, se aplicavel, Apple App Store.
5. Redis adapter ou arquitetura equivalente para WebSocket em escala horizontal.
6. Monitoramento/alertas externos para API, banco, storage e 5xx.
7. Ensaio de backup/restore com evidencia.

### Importantes apos lancamento

1. MFA para admins.
2. App version enforcement.
3. Play Integrity/App Attest.
4. Analise de custo de mapas, push e storage.
5. Antimalware/CDR para comprovantes se volume/riscos aumentarem.

### Opcionais futuros

1. PWA installable para empresas.
2. Atualizador automatico do Electron.
3. Ofuscacao/minificacao adicional mobile.
4. Dashboard de SLA comercial.

## Plano ate lancamento nacional

| Ordem | Prioridade | Responsavel tecnico | Dependencia | Evidencia | Criterio de aceite | Risco | Ambiente |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Alta | DevOps | GitHub | Branch protection screenshot/config | PR + CI obrigatorios na main | Merge inseguro | GitHub |
| 2 | Alta | Backend/DevOps | Railway | Restore em banco sandbox | RPO/RTO documentados e testados | Perda de dados | Sandbox |
| 3 | Alta | Mobile | EAS/Android | APK/AAB release instalado | Cliente/motoboy operam sem Expo Go | App nao distribuivel | Sandbox |
| 4 | Alta | Backend | Store timezone | Testes relatorios por fuso | Loja usa timezone proprio | Fechamento errado | Sandbox |
| 5 | Alta | Mobile/Backend | Push provider | Push por role/loja/pedido | Eventos chegam em background | Operacao perde pedidos | Sandbox |
| 6 | Alta | Infra | Redis ou equivalente | Teste 2 replicas | Eventos isolados e entregues | Vazamento/queda realtime | Sandbox |
| 7 | Alta | Juridico/Produto | Documentos | Politica/termos aprovados | Publicacao permitida | Risco LGPD | Documento |
| 8 | Media | Produto/Mobile | Contas lojas | Internal/closed testing | Build aprovado na loja | Reprovacao loja | Google/Apple |
| 9 | Media | Backend | Observabilidade | Alertas ativos | API/banco/storage alertam | Incidente silencioso | Producao |
| 10 | Media | Segurança | Auth provider | MFA admin | Admins com 2FA | Conta comprometida | Sandbox |
