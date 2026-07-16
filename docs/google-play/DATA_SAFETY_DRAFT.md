# Data Safety - Rascunho Tecnico

Baseado na documentacao oficial Google Play:

- Data Safety: https://support.google.com/googleplay/android-developer/answer/10787469
- User Data policy: https://support.google.com/googleplay/android-developer/answer/10144311
- Account deletion: https://support.google.com/googleplay/android-developer/answer/13327111

Este rascunho precisa ser conferido pelo responsavel legal antes de preencher a Play Console.

## Coleta de dados

Provavel resposta: o app coleta dados de usuarios.

## Dados pessoais

- Nome: cadastro, pedidos, perfil, suporte.
- E-mail: login, comunicacao e recuperacao operacional.
- Telefone: contato de entrega, suporte e perfil.
- Endereco: entrega de pedidos.
- Fotos/arquivos: foto de perfil, imagens e comprovantes enviados voluntariamente.

## Dados financeiros/operacionais

- Metodo de pagamento.
- Status de pagamento.
- Comprovante Pix manual.
- Historico de pedidos.
- Vendas/caixa pertencem ao painel da empresa, mas impactam dados operacionais do ecossistema.

## Identificadores e dispositivo

- Identificador interno de usuario.
- Token de sessao local.
- Device token apenas se push for ativado.
- Diagnosticos e logs tecnicos quando monitoramento estiver habilitado.

## Finalidades

- Funcionalidade do app.
- Gerenciamento de conta.
- Processamento de pedidos e entregas.
- Prevencao de fraude e seguranca.
- Suporte.
- Analytics/diagnostico tecnico apenas se configurado.

## Compartilhamento

Nao declarar compartilhamento comercial sem contrato. Declarar subprocessadores tecnicos quando a Play Console considerar transmissao a terceiros como compartilhamento conforme sua definicao.

## Criptografia em transito

Sim, producao usa HTTPS.

## Exclusao de conta

O app deve oferecer link publico para solicitacao de exclusao. A exclusao automatica destrutiva nao esta ativa; historicos legais/operacionais podem ser preservados ou anonimizados conforme politica.

## Confirmar antes de enviar

- [ ] E-mail de privacidade oficial.
- [ ] URL publica final de privacidade.
- [ ] URL publica final de exclusao de conta.
- [ ] Se Sentry estara ativo em producao e quais dados sao enviados.
- [ ] Se push sera ativado no primeiro envio.
- [ ] Se Asaas/Pix automatico permanecera desligado na versao enviada.
