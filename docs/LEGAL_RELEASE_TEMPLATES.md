# Modelos tecnicos para documentos legais

**REQUER REVISAO JURIDICA PROFISSIONAL.**

Este arquivo e um insumo tecnico para advogado/contador/DPO. Nao publicar como documento legal final sem revisao profissional.

## Politica de privacidade

### Dados tratados

- Cliente: nome, e-mail, telefone, endereco, pedidos, pagamentos, comprovantes Pix e historico de atendimento.
- Motoboy: nome, e-mail, telefone, perfil, veiculo, cidade, vinculos com lojas e entregas.
- Loja/operador: nome, e-mail, telefone, dados da empresa, produtos, vendas, caixa, estoque, relatorios e auditoria operacional.
- Administrador da plataforma: dados de conta e logs de acoes administrativas.

### Finalidades

- Criar e manter contas.
- Processar pedidos, vendas, entregas, caixa e estoque.
- Exibir catalogos e historico operacional.
- Permitir suporte, seguranca, auditoria e prevencao de fraude.
- Enviar notificacoes operacionais quando habilitadas.

### Subprocessadores tecnicos

- Railway: API e banco PostgreSQL.
- Netlify: painel web.
- Cloudflare R2: imagens e comprovantes.
- Sentry: erros tecnicos, se habilitado.
- Expo/EAS: builds e notificacoes mobile quando configuradas.
- Asaas: pagamentos automaticos somente se ativados em fase futura.

## Termos de uso

### Cliente

- Deve informar dados corretos para entrega.
- Deve acompanhar status e forma de pagamento escolhida.
- Comprovantes enviados devem ser verdadeiros e relacionados ao pedido.

### Loja

- E responsavel por produtos, precos, atendimento, entrega, caixa, estoque e conferencia de pagamentos manuais.
- Deve manter dados Pix e taxas de entrega corretos.
- Deve respeitar regras de privacidade dos clientes e motoboys.

### Motoboy

- Deve manter dados de perfil atualizados.
- Deve aceitar somente entregas que possa cumprir.
- Deve tratar dados de cliente e loja apenas para a entrega.

## Retencao e descarte

- Pedidos, vendas, caixa, estoque, pagamentos e auditoria podem exigir retencao por prazo legal/contratual.
- Contas inativas podem ser suspensas ou anonimizadas quando juridicamente permitido.
- Comprovantes Pix devem ficar privados e ter retencao definida em contrato/politica.
- Dados de QA devem usar prefixos controlados e scripts seguros de limpeza.

## Solicitacao do titular

1. Receber solicitacao por canal oficial de suporte.
2. Validar identidade do solicitante.
3. Registrar protocolo, data e tipo de solicitacao.
4. Executar acesso, correcao, exclusao, portabilidade ou revogacao quando juridicamente permitido.
5. Preservar dados que tenham obrigacao legal, financeira, auditoria ou defesa.
6. Registrar evidencia da resposta.

## Resposta a incidente

1. Classificar severidade.
2. Conter o incidente e congelar deploys nao essenciais.
3. Rotacionar credenciais afetadas.
4. Revogar sessoes quando houver risco de token.
5. Coletar logs sanitizados.
6. Corrigir em branch isolada e validar em sandbox.
7. Registrar linha do tempo, escopo, impacto e evidencias.
8. Avaliar comunicacao a titulares/autoridades com apoio juridico.

## Notificacoes

- Notificacoes devem conter apenas dados operacionais minimos.
- Usuario pode negar permissao no dispositivo.
- Push nao deve carregar token, chave Pix completa, comprovante, endereco completo ou dado sensivel desnecessario.

## Localizacao

- O estado atual nao depende de rastreamento continuo de localizacao.
- Se rastreamento em tempo real for implementado, sera necessario aviso claro, permissao especifica, finalidade, retencao e politica dedicada.

## Textos para lojas de aplicativos

### Google Play Data Safety

- Coleta dados pessoais: nome, e-mail, telefone, endereco e historico de pedidos.
- Coleta dados financeiros operacionais: forma/status de pagamento e comprovantes, quando usados.
- Coleta imagens/arquivos enviados voluntariamente.
- Dados sao usados para operacao, seguranca, suporte e cumprimento contratual.
- Dados trafegam por HTTPS e arquivos privados exigem autenticacao.

### App Store Privacy

- Contact Info: nome, e-mail, telefone.
- User Content: comprovantes e imagens enviados pelo usuario.
- Purchase/Transaction Data: pedidos, pagamentos, vendas e historico operacional.
- Identifiers: identificadores internos de conta e sessao.
- Diagnostics: erros tecnicos, se Sentry estiver habilitado.

