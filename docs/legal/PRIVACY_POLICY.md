# Politica de Privacidade - Mototake

REQUER REVISAO JURIDICA PROFISSIONAL ANTES DO LANCAMENTO PUBLICO

Versao tecnica: 2026-07-16

Este documento e um rascunho tecnico para revisao juridica. Ele nao substitui contrato, politica final de privacidade, parecer LGPD ou orientacao profissional.

## Controlador

- Razao social: [RAZAO SOCIAL]
- CNPJ: [CNPJ]
- Endereco: [ENDERECO]
- E-mail de privacidade: [E-MAIL DE PRIVACIDADE]
- E-mail de suporte: [E-MAIL DE SUPORTE]

## Dados tratados

- Conta: nome, e-mail, telefone, senha protegida por hash, role/perfil, status operacional e sessoes.
- Cliente: endereco de entrega, historico de pedidos, carrinho operacional, observacoes de pedido e comprovantes enviados voluntariamente.
- Motoboy: dados de perfil, telefone, cidade, veiculo, placa quando informada, foto de perfil, vinculos com empresas e entregas.
- Empresa/loja: dados cadastrais, responsaveis, produtos, imagens, estoque, taxas por bairro, Pix manual, vendas PDV, caixa e relatorios.
- Pagamentos: metodo, status, comprovantes Pix manuais, referencias informadas pelo usuario e historico de confirmacao manual.
- Arquivos: imagens de loja/produto/motoboy e comprovantes privados.
- Logs: registros tecnicos, auditoria administrativa, requestId, erros, eventos de pedido, venda, caixa e estoque.
- Dispositivo: tokens de notificacao quando push estiver habilitado, identificadores tecnicos de sessao e metadados minimos de seguranca.

## Finalidades

- Criar e autenticar contas.
- Operar pedidos, entregas, vendas de balcado, caixa, estoque e relatorios.
- Exibir catalogo de empresas e produtos.
- Permitir suporte, auditoria, seguranca e prevencao de abuso.
- Registrar comprovantes e conferir pagamentos manuais.
- Enviar notificacoes operacionais quando o recurso estiver habilitado.

## Compartilhamento tecnico

O Mototake pode usar subprocessadores tecnicos para hospedar API, banco, painel, arquivos, builds, monitoramento e notificacoes. A lista tecnica esta em `SUBPROCESSORS.md`.

## Seguranca

- Trafego protegido por HTTPS em producao.
- Autenticacao por token e refresh token.
- Controle por perfil: cliente, motoboy, empresa e administrador da plataforma.
- Arquivos privados servidos por endpoints autenticados quando aplicavel.
- Segredos nao devem ser incluidos em aplicativos, repositorio ou logs.

## Retencao

Pedidos, vendas, caixa, estoque, pagamentos, comprovantes e auditoria podem precisar ser preservados por obrigacoes legais, seguranca, antifraude, suporte ou defesa de direitos. A exclusao pode ocorrer por anonimizacao, bloqueio ou remocao quando juridicamente permitido.

## Direitos do titular

O usuario pode solicitar acesso, correcao, revisao, portabilidade, revogacao de consentimento ou exclusao/anonimizacao pelo canal [E-MAIL DE PRIVACIDADE]. A identidade do solicitante deve ser validada antes de qualquer acao.

## Exclusao de conta

O Mototake prepara canal de solicitacao em `/account-deletion`. A exclusao automatica destrutiva nao esta habilitada nesta fase. Dados operacionais que precisem ser mantidos por obrigacao legal, financeira, seguranca ou auditoria poderao ser preservados ou anonimizados conforme politica final revisada.

