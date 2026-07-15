# Checklist de publicacao mobile

Este checklist prepara Android e iOS para distribuicao. Nao publicar sem aprovacao explicita.

## Estado atual

- Projeto mobile: `apps/mobile`.
- Tecnologia: Expo SDK 53 / React Native 0.79.
- Android package: `com.deliveryplatform.courier`.
- Nome atual: `Delivery Platform Courier`.
- Versao: `0.1.0`.
- EAS projectId: `6ebb569d-12af-4f00-8e5d-6b64a668c661`.
- App unico atende cliente e motoboy por fluxo/role.
- iOS nao foi validado nesta auditoria.

## Android

Antes de Play Store:

1. Definir nome final do app.
2. Confirmar package ID definitivo.
3. Atualizar icone e splash.
4. Confirmar `versionCode` incremental.
5. Gerar AAB production com API oficial.
6. Instalar build release em aparelho real ou internal testing.
7. Validar login cliente, catalogo, carrinho, pedido, comprovante e motoboy.
8. Preencher Data Safety.
9. Publicar politica de privacidade.
10. Configurar e-mail e URL de suporte.
11. Confirmar se havera notificacoes push antes do lancamento nacional.

## iOS

Necessario:

1. Conta Apple Developer paga.
2. Bundle ID definitivo. Preparado tecnicamente como `com.deliveryplatform.courier`; revisar quando nome final for decidido.
3. Certificados/provisioning.
4. App Store Connect.
5. Privacy manifest e informacoes de coleta.
6. TestFlight.
7. Screenshots e textos.
8. Validacao em dispositivo iOS real.

Configuracao tecnica ja preparada:

- `ios.bundleIdentifier`.
- `ios.supportsTablet=false`.
- Descricoes `NSPhotoLibraryUsageDescription` e `NSCameraUsageDescription`.

## Protecoes recomendadas

- Nao embutir secrets no app.
- Manter todas as autorizacoes criticas no backend.
- Desabilitar logs sensiveis em release.
- Avaliar Play Integrity/App Attest antes de pagamentos automaticos em escala.
- Definir politica de versao minima suportada.

## Comandos existentes

```powershell
pnpm --filter @deliveries/mobile typecheck
pnpm --filter @deliveries/mobile lint
pnpm --filter @deliveries/mobile build
pnpm --filter @deliveries/mobile config:check
pnpm --filter @deliveries/mobile build:android:preview
pnpm --filter @deliveries/mobile build:android:production
```

## Pendencias manuais inevitaveis

- Contas Google Play e Apple Developer.
- Dados legais, CNPJ/CPF responsavel, e-mail suporte e politica de privacidade.
- Textos comerciais, screenshots, icone e nome final.
- Aceite das politicas das lojas.
