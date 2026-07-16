# Runbook - Teste Fechado Google Play

## Fonte

Usar sempre a Play Console e a documentacao oficial vigente antes de publicar.

Referencias oficiais:

- Tracks de teste: https://support.google.com/googleplay/android-developer/answer/9845334
- Requisitos de teste para novas contas pessoais: https://support.google.com/googleplay/android-developer/answer/14151465

Requisitos para contas novas podem variar por tipo de conta e data de criacao.

## Preparacao

- Definir lista inicial de testadores.
- Preparar roteiro curto de validacao.
- Garantir canal de suporte.
- Garantir que a build enviada nao usa sandbox.
- Garantir politica de privacidade e exclusao de conta validas.

## Passos

1. Abrir Testing > Closed testing.
2. Criar track fechado.
3. Adicionar testadores por lista de e-mails ou grupo.
4. Criar release com AAB aprovado no teste interno.
5. Preencher notas de versao.
6. Enviar para revisao.
7. Distribuir link de opt-in.
8. Coletar feedback por formulario.
9. Acompanhar crashes, ANRs e relatos.
10. So solicitar producao quando os criterios atuais da Play Console forem atendidos.

## Nao assumir

Nao assumir numero de testadores ou prazo sem confirmar no painel da conta Google Play usada.
