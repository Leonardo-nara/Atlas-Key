# Seguranca de deploy Netlify sandbox

Este projeto possui sites oficiais e sites temporarios de validacao. Para evitar deploy acidental no painel oficial, nunca use o vinculo local da Netlify CLI como fonte de verdade.

## Sites permitidos nesta branch

| Aplicacao | Site | Site ID | URL |
| --- | --- | --- | --- |
| Loja publica sandbox | `mototake-demo-cliente` | `95e9d819-f336-4eda-aab6-82ad11d1931e` | `https://mototake-demo-cliente.netlify.app` |
| Painel empresarial sandbox | `mototake-painel-sandbox` | `be7b5676-72b2-4b2d-906b-2b70e8dbb0a4` | `https://mototake-painel-sandbox.netlify.app` |

## Sites bloqueados

| Site | Site ID | Motivo |
| --- | --- | --- |
| `mototake-painel` | `cb7830bb-d9e1-4cfa-814b-c985b57aa491` | Painel oficial protegido |
| `mototake-painel-demo` | `5cf07ecb-c068-4166-8c7a-d04eb4c7a543` | Demonstracao congelada |

## Comandos seguros

Publicar loja publica sandbox:

```powershell
$env:MOTOTAKE_NETLIFY_SANDBOX_CONFIRM="DEPLOY_SANDBOX_ONLY"
node scripts/deploy-netlify-sandbox.mjs --app=storefront --sandbox
```

Publicar painel empresarial sandbox:

```powershell
$env:MOTOTAKE_NETLIFY_SANDBOX_CONFIRM="DEPLOY_SANDBOX_ONLY"
node scripts/deploy-netlify-sandbox.mjs --app=panel --sandbox
```

O script imprime somente o nome e o ID do site de destino. Ele nao imprime tokens, secrets ou variaveis sensiveis.

## Verificacao antes do deploy

Antes de publicar, confirme:

```powershell
git branch --show-current
git status --short
npx netlify api getSite --data '{\"site_id\":\"95e9d819-f336-4eda-aab6-82ad11d1931e\"}'
npx netlify api getSite --data '{\"site_id\":\"be7b5676-72b2-4b2d-906b-2b70e8dbb0a4\"}'
```

Nao use `netlify deploy` diretamente dentro de `apps/desktop`, porque essa pasta pode conter `.netlify/state.json` local apontando para o site oficial.

## Recuperacao de deploy oficial

Se o site oficial `mototake-painel` for alterado por engano, restaure o deploy estavel conhecido:

```powershell
$env:NODE_OPTIONS="--use-system-ca"
npx netlify api restoreSiteDeploy --data '{\"site_id\":\"cb7830bb-d9e1-4cfa-814b-c985b57aa491\",\"deploy_id\":\"6a598a64fdd14a01ec01f187\"}'
```

Depois confirme:

```powershell
npx netlify api getSite --data '{\"site_id\":\"cb7830bb-d9e1-4cfa-814b-c985b57aa491\"}'
```

O deploy publicado deve ser `6a598a64fdd14a01ec01f187`, correspondente ao painel estavel `4169f15`.

## Por que nao confiar no vinculo local

O diretorio `.netlify/` e ignorado pelo Git e pode apontar para qualquer site na maquina local. Em monorepo, a CLI tambem pode ler `netlify.toml` da raiz e publicar o build errado. Por isso, todo deploy sandbox deve usar ID explicito do site e passar pela allowlist do script.
