# Politica de Resposta a Incidentes - Mototake

REQUER REVISAO JURIDICA PROFISSIONAL ANTES DO LANCAMENTO PUBLICO

Versao tecnica: 2026-07-16

## Severidade

- Critico: indisponibilidade geral, vazamento de dados, acesso indevido, perda financeira ou corrupcao de dados.
- Alto: falha relevante em pedidos, pagamentos, caixa, estoque ou autenticacao.
- Medio: falha parcial com contorno operacional.
- Baixo: bug visual, texto, lentidao ou caso isolado sem impacto operacional relevante.

## Processo

1. Registrar incidente com data, hora, ambiente e impacto.
2. Conter risco: pausar deploys, revogar sessoes ou desativar feature flag se necessario.
3. Preservar evidencias sem expor segredos.
4. Corrigir em branch isolada e validar em sandbox.
5. Publicar correcao controlada se necessario.
6. Documentar causa, impacto, correcao e prevencao.
7. Avaliar comunicacao a titulares, clientes, parceiros ou autoridades com suporte juridico.

## Proibido em logs

Senhas, tokens, refresh tokens, chaves Pix completas, API keys, arquivos/base64 e segredos de storage.

