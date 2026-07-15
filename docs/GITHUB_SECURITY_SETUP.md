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
9. Marque como check obrigatorio: `Validate monorepo`.
10. Ative `Require conversation resolution before merging`.
11. Ative `Do not allow bypassing the above settings`, se disponivel no plano.
12. Desative force push em `Allow force pushes`.
13. Desative exclusao em `Allow deletions`.
14. Salve a regra.

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

- Pull requests para `main` nao podem ser mergeados sem o check `Validate monorepo`.
- Push direto na `main` deve ser bloqueado para usuarios sem bypass.
- Force push e delete da `main` devem estar bloqueados.
- Alertas de dependencia e segredo devem aparecer em `Security`.
