# Super Admin Mototake

Este documento registra o fluxo seguro para criar e operar a conta `SUPER_ADMIN`.

## Criar primeira conta

Defina as variaveis apenas em um shell seguro ou na plataforma de deploy:

```powershell
$env:SUPER_ADMIN_EMAIL="admin@exemplo.com"
$env:SUPER_ADMIN_NAME="Nome do Admin"
$env:SUPER_ADMIN_PASSWORD="<senha-forte>"
pnpm --filter @deliveries/backend admin:create-super:prod
```

O script:

- cria somente usuario com role `SUPER_ADMIN`;
- nao imprime senha;
- nao grava segredo em arquivo;
- nao promove usuario existente sem `SUPER_ADMIN_ALLOW_PROMOTE=true`;
- usa o mesmo hash de senha do restante do backend.

## Permissoes

`SUPER_ADMIN` acessa os endpoints protegidos `/api/admin/*`.

Perfis `STORE_ADMIN`, `COURIER` e `CLIENT` devem receber `403` nessas rotas. Sem token deve retornar `401`.

`PLATFORM_ADMIN` permanece aceito como compatibilidade legada ate a migracao operacional completa.

## Operacoes

No desktop, o Super Admin visualiza:

- Dashboard geral;
- Empresas;
- Detalhes da empresa;
- Usuarios;
- Motoboys;
- Sistema;
- Auditoria.

Suspender ou encerrar empresa preserva historico e revoga sessoes ativas do dono da loja. O cliente nao recebe o motivo administrativo.
