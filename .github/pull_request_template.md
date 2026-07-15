## Escopo

- [ ] Backend
- [ ] Painel web/desktop
- [ ] Mobile
- [ ] Infra/deploy
- [ ] Documentacao/scripts

## Validacoes obrigatorias

- [ ] `pnpm --filter @deliveries/backend prisma:generate`
- [ ] `pnpm --filter @deliveries/backend test`
- [ ] `pnpm --filter @deliveries/backend typecheck`
- [ ] `pnpm --filter @deliveries/backend lint`
- [ ] `pnpm --filter @deliveries/backend build`
- [ ] `pnpm --filter @deliveries/desktop typecheck`
- [ ] `pnpm --filter @deliveries/desktop lint`
- [ ] `pnpm --filter @deliveries/desktop build`
- [ ] `pnpm --filter @deliveries/mobile typecheck`
- [ ] `pnpm --filter @deliveries/mobile lint`
- [ ] `pnpm --filter @deliveries/mobile build`
- [ ] `pnpm --filter @deliveries/mobile config:check`
- [ ] `git diff --check`

## Seguranca

- [ ] Nao inclui secrets, tokens, senhas, DSN privado, `DATABASE_URL` real ou chaves R2.
- [ ] Nao altera producao, Railway, Netlify, EAS ou Asaas sem aprovacao explicita.
- [ ] Nao cria dados QA em producao.
- [ ] Rotas novas possuem guards/roles e validacao de DTO.
- [ ] Uploads/arquivos continuam privados e validados no backend.

## Banco e deploy

- [ ] Sem migration.
- [ ] Migration segura e reversivel/compatibilizada.
- [ ] Requer migration em sandbox antes de producao.

## Observacoes

Descreva riscos, rollback e evidencias de teste.
