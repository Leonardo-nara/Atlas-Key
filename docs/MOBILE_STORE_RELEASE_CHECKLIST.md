# Checklist de publicacao mobile

Este checklist prepara Android e iOS para distribuicao. Nao publicar sem aprovacao explicita.

## Estado atual

- Projeto mobile: `apps/mobile`.
- Tecnologia: Expo SDK 53 / React Native 0.79.
- Android package: `com.souzaworks.mototake`.
- Nome atual: `Mototake`.
- Versao: `1.0.0`.
- versionCode atual: `1`.
- EAS projectId: `6ebb569d-12af-4f00-8e5d-6b64a668c661`.
- App unico atende cliente e motoboy por fluxo/role.
- iOS nao foi validado nesta auditoria.

## Android

Antes de Play Store:

1. Confirmar nome final do app: `Mototake`.
2. Confirmar package ID definitivo: `com.souzaworks.mototake`.
3. Atualizar icone e splash finais.
4. Confirmar `versionCode` incremental. Se o AAB versionCode 1 for enviado a Play Console, o proximo AAB deve usar versionCode 2.
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
2. Bundle ID definitivo. Preparado tecnicamente como `com.souzaworks.mototake`; revisar antes de criar o app no Apple Developer.
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
- Textos comerciais, screenshots, icone e splash finais.
- Aceite das politicas das lojas.
