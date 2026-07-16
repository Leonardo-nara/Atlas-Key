# Runbook - Teste Interno Google Play

## Pre-requisitos

Referencia oficial: https://support.google.com/googleplay/android-developer/answer/9845334

- Conta Google Play Console ativa.
- App criado com package `com.souzaworks.mototake`.
- Play App Signing configurado.
- AAB production validado.
- Politica de privacidade e exclusao de conta publicadas.
- Lista de testadores com contas Google.

## Passos

1. Abrir Play Console.
2. Criar app Mototake.
3. Preencher App content minimo exigido.
4. Ir em Testing > Internal testing.
5. Criar release interna.
6. Enviar o AAB production.
7. Adicionar testadores por e-mail ou grupo.
8. Publicar teste interno.
9. Instalar pela Play Store usando link de opt-in.
10. Validar CLIENT: login, empresas, catalogo, carrinho, pedido, comprovante e perfil.
11. Validar COURIER: login, empresas, pedidos disponiveis, meus pedidos e perfil.
12. Registrar falhas no `docs/pilot/PILOT_INCIDENT_LOG.md`.

## Criterio de aceite

- Instala pela Play Store.
- Abre como Mototake.
- Usa API oficial.
- Nao aponta para sandbox ou localhost.
- Nao apresenta crashes no fluxo CLIENT/COURIER.
