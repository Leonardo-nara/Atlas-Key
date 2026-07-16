# Subprocessadores Tecnicos - Mototake

REQUER REVISAO JURIDICA PROFISSIONAL ANTES DO LANCAMENTO PUBLICO

Versao tecnica: 2026-07-16

Esta lista descreve fornecedores tecnicos previstos ou ja usados. Deve ser revisada antes do lancamento publico.

| Fornecedor | Uso | Dados potenciais |
| --- | --- | --- |
| Railway | API backend e PostgreSQL | Contas, pedidos, vendas, estoque, pagamentos, logs operacionais |
| Netlify | Painel web | Arquivos estaticos do painel, acesso ao frontend |
| Cloudflare R2 | Storage S3 compativel | Imagens e comprovantes privados |
| Expo/EAS | Build Android/iOS | Artefatos de build e metadados do app |
| Sentry | Monitoramento de erros, se habilitado | Erros tecnicos sanitizados, requestId e contexto minimo |
| Asaas Sandbox | Testes de gateway, desligado em producao | Dados de teste de cobranca em sandbox |
| Google Play | Distribuicao Android futura | Metadados de app, testadores e relatorios da loja |
| Apple Developer | Distribuicao iOS futura | Metadados de app e testadores, quando houver iOS |

Nenhum fornecedor deve receber segredos por codigo-fonte ou logs.

