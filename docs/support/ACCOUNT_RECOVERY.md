# Recuperacao de Conta

## Regras

- Nunca pedir senha atual.
- Nunca enviar senha por canal publico.
- Validar identidade antes de alterar acesso.
- Registrar quem solicitou, quem executou e quando.

## Plataforma admin

1. Confirmar que o solicitante e responsavel autorizado.
2. Verificar status do usuario e da loja.
3. Se necessario, redefinir senha por script seguro ou acao administrativa existente.
4. Orientar troca de senha apos primeiro acesso, quando o fluxo existir.

## PLATFORM_ADMIN

Usar somente script seguro no ambiente correto:

```powershell
pnpm --filter @deliveries/backend admin:reset-password:prod
```

Exigir envs e nunca imprimir senha.

