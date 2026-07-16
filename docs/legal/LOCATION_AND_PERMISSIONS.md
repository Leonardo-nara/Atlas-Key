# Localizacao e Permissoes - Mototake

REQUER REVISAO JURIDICA PROFISSIONAL ANTES DO LANCAMENTO PUBLICO

Versao tecnica: 2026-07-16

## Estado atual Android

- O app nao declara permissao de localizacao no `app.json`.
- O app usa selecao de imagens/documentos para foto de perfil, imagens e comprovantes.
- O app usa SecureStore para sessao local.
- Push esta tecnicamente preparado, mas push real deve permanecer desligado ate configuracao explicita.

## Camera e galeria

O usuario pode escolher enviar imagens ou comprovantes. O envio deve ser voluntario e relacionado ao fluxo operacional.

## Localizacao futura

Qualquer rastreamento em tempo real ou localizacao precisa de revisao especifica, aviso claro, permissao adequada, finalidade definida, retencao e controles de privacidade.

