# Configuracao obrigatoria de seguranca do GitHub

Este procedimento deve ser executado por uma conta com permissao de administrador no repositorio `Leonardo-nara/Atlas-Key`.

## Branch protection da `main`

1. Abra `Settings > Branches > Add branch protection rule`.
2. Em `Branch name pattern`, informe `main`.
3. Ative `Require a pull request before merging`.
4. Ative `Require approvals` e configure `1` aprovacao minima.
5. Ative `Dismiss stale pull request approvals when new commits are pushed`.
6. Ative `Require review from Code Owners`.
7. Ative `Require status checks to pass before merging`.
8. Ative `Require branches to be up to date before merging`.
9. Marque como checks obrigatorios:
   - `Backend`
   - `Backend e2e with Postgres`
   - `Desktop`
   - `Mobile`
   - `Security scan and diff check`
10. Ative `Require conversation resolution before merging`.
11. Ative `Do not allow bypassing the above settings`, se disponivel no plano.
12. Desative force push em `Allow force pushes`.
13. Desative exclusao em `Allow deletions`.
14. Salve a regra.

## Vercel

O Mototake usa Railway para backend e Netlify para painel web. O check `Vercel` nao deve ser obrigatorio.

Se o check continuar aparecendo:

1. Abra GitHub > `Leonardo-nara/Atlas-Key` > `Settings` > `Integrations` ou `Webhooks`.
2. Localize a integracao/app Vercel associada ao projeto `atlas-key`.
3. Remova o repositorio da integracao Vercel ou desative o projeto Vercel que nao e usado.
4. Abra Vercel > projeto `atlas-key`.
5. Em `Settings > Git`, desconecte o repositorio ou desative deploys automaticos.
6. Confirme que Railway e Netlify continuam conectados.
7. Confirme que o check Vercel nao aparece como required em `Settings > Branches > main`.

## Secret scanning e dependencias

1. Abra `Settings > Code security and analysis`.
2. Ative `Dependency graph`.
3. Ative `Dependabot alerts`.
4. Ative `Dependabot security updates`.
5. Ative `Secret scanning`, se disponivel no plano.
6. Ative `Push protection`, se disponivel no plano.

## Tags de release

1. Abra `Settings > Tags > New rule`, se a opcao estiver disponivel.
2. Padrao: `v*`.
3. Exigir permissao de maintainer/admin para criar ou apagar tags.

## Evidencia esperada

- Pull requests para `main` nao podem ser mergeados sem os cinco checks obrigatorios da CI.
- Push direto na `main` deve ser bloqueado para usuarios sem bypass.
- Force push e delete da `main` devem estar bloqueados.
- Alertas de dependencia e segredo devem aparecer em `Security`.
