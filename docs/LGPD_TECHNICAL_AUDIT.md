# Auditoria tecnica LGPD do Mototake

**REQUER REVISAO JURIDICA PROFISSIONAL.**

Este documento e um mapeamento tecnico para apoiar a criacao de politicas, contratos e processos. Nao substitui advogado, contador ou DPO.

## Dados pessoais tratados

| Titular | Dados | Finalidade operacional | Retencao sugerida | Observacoes |
| --- | --- | --- | --- | --- |
| Cliente | nome, e-mail, telefone, endereco, pedidos, pagamentos, comprovantes | cadastro, pedido, entrega, suporte | enquanto conta ativa e prazo legal/defesa | excluir/anonimizar sem quebrar historico fiscal/financeiro |
| Motoboy | nome, e-mail, telefone, perfil, vinculos, entregas | operacao de entrega e suporte | enquanto vinculo/conta ativa e prazo de defesa | localizacao futura exige transparencia |
| Loja/operador | nome, e-mail, telefone, acoes no painel, caixa/PDV | operacao e auditoria | conforme contrato e prazo de defesa | auditoria nao deve salvar senha/token |
| Admin plataforma | acoes administrativas | rastreabilidade e suporte | prazo contratual/seguranca | acesso restrito |

## Subprocessadores tecnicos

- Railway: backend e Postgres.
- Netlify: painel web.
- Cloudflare R2: arquivos de imagem e comprovantes.
- Sentry: erros, se habilitado.
- Asaas: somente sandbox no estado atual; producao nao ativada.
- Expo/EAS: builds mobile, quando usado.

## Lacunas obrigatorias antes de escala nacional

1. Politica de privacidade publica.
2. Termos de uso para cliente, loja e motoboy.
3. Politica de retencao e descarte.
4. Processo de solicitacao do titular: acesso, correcao, exclusao, portabilidade e revogacao.
5. Processo de incidente: triagem, contencao, registro, comunicacao e prazo.
6. Registro de subprocessadores e bases contratuais.
7. Politica para comprovantes Pix e arquivos enviados.
8. Transparencia sobre notificacoes e eventual localizacao.

## Regras tecnicas recomendadas

- Nunca logar senha, JWT, refresh token, Authorization, chave Pix completa ou arquivo/base64.
- Exportacoes CSV devem continuar protegidas por role e tenant.
- Exclusao de usuario nao deve apagar historico financeiro sem analise de obrigacao legal.
- Comprovantes devem permanecer privados e acessiveis apenas ao cliente dono e loja dona.
- Dados de QA devem usar prefixos controlados e cleanup seguro.

## Rascunho de processo de titular

1. Validar identidade do solicitante.
2. Registrar protocolo e data.
3. Classificar solicitacao.
4. Executar consulta/exportacao/correcao/anonimizacao quando juridicamente permitido.
5. Registrar evidencia da conclusao.
6. Nao remover dados financeiros ou auditoria sem avaliacao de retencao.

## Rascunho de incidente

1. Severidade critica: exposicao de credenciais, vazamento entre lojas, acesso indevido a comprovantes, perda de banco.
2. Congelar deploys nao essenciais.
3. Rotacionar secrets afetados.
4. Revogar sessoes se houver risco de token.
5. Coletar logs sanitizados.
6. Corrigir em branch isolada e validar no sandbox.
7. Registrar linha do tempo e impacto.
8. Avaliar obrigacao de comunicacao com apoio juridico.

