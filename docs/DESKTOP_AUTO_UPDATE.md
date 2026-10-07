# Atualizacao desktop MotoTake

Bootstrap: 1.0.1. Instalar uma ultima vez sobre a 1.0.0, sem desinstalar.
O nome interno `@deliveries/desktop`, appId `com.mototake.desktop`, chave NSIS,
localStorage e diretorio userData existentes sao preservados. Nenhuma rotina
de limpeza e adicionada. Dados do servidor nao fazem parte do instalador.
O NSIS padrao substitui arquivos da aplicacao; seu uninstaller interno pode
rodar em modo de update, sem exigir desinstalacao manual nem apagar AppData.

## Operacao

- Somente Windows empacotado consulta GitHub, 10 segundos apos iniciar e a cada 6 horas.
- Sem nova versao ou sem rede: silencioso, operacao normal.
- `Atualizar agora`: autoriza o download, com progresso.
- `Reiniciar e atualizar`: autoriza a instalacao; fechar normalmente nao instala.
- `Depois`: oculta o aviso dessa versao ate a proxima abertura.
- Apenas tres comandos IPC, restritos a janela/frame principal e arquivo local empacotado.
- Preload isolado, sandbox e nodeIntegration desligado permanecem ativos.
- Nada muda no painel web; a ponte Electron nao existe no navegador.

## Release explicita

Provider publico: https://github.com/Leonardo-nara/Atlas-Key/releases
Prefixo de tag: `desktop-v`; somente versoes estaveis SemVer, sem downgrade.
O cliente nao precisa de token. `app-update.yml` e gerado pelo electron-builder.
Nao definir setFeedURL, tokens no publish, ou credenciais no renderer.

1. Incrementar apps/desktop/package.json para a proxima versao real.
2. Validar typecheck, lint, test:updater, build e NSIS.
3. Validar `node scripts/validate-desktop-update.cjs`.
4. Commit/push aprovado e tag explicita `desktop-vX.Y.Z`.
5. Push da tag inicia `.github/workflows/desktop-release.yml`.
6. Job Windows publica .exe, .exe.blockmap, latest.yml e SHA-256 em draft.
7. Somente apos upload completo a release fica publica/estavel.

O workflow usa somente GITHUB_TOKEN do Actions, contents:write apenas no job.
Nao roda em PR ou em todo push da main. Nao cria servidor ou recurso pago.
Runner padrao de repositorio publico; nao usar runners maiores/pagos.

## Limites da validacao

Tests do controller exercitam consentimento, progresso, erros, idempotencia,
IPC e dev. Manifesto confere SHA-512, tamanho e feed sem token. Esses testes
nao substituem atualizar uma instalacao real para uma versao posterior.
Na proxima release real, confirmar deteccao, download, reinicio, versao final
e preservacao da sessao sobre a bootstrap. Nao publicar versoes artificiais.

O instalador atual nao possui certificado confiavel: SmartScreen pode avisar.
HTTPS e checksum nao substituem assinatura Authenticode. Nao comprar certificado
nesta fase. Revisar politica de assinatura antes de distribuicao ampla.

Fontes oficiais:
- https://www.electron.build/docs/features/auto-update/
- https://www.electron.build/v26/docs/publish/
- https://www.electron.build/docs/nsis/
