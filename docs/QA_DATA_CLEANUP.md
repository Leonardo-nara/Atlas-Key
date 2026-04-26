# Dados de QA em producao

Este projeto usa dados com prefixos controlados para smoke tests em producao. A limpeza deve ser manual e revisada, nunca automatica sem confirmacao.

## Prefixos usados

- `qa.`
- `qa-`
- `QA `
- `smoke-`
- `cliente-smoke-`

## Como localizar antes de apagar

No banco de producao, filtre primeiro por email/nome e revise os registros relacionados:

```sql
select id, email, name, role, "createdAt"
from "User"
where lower(email) like 'qa.%@example.com'
   or lower(email) like 'smoke-%'
   or lower(name) like 'qa %'
order by "createdAt" desc;
```

```sql
select id, name, "ownerUserId", "createdAt"
from "Store"
where lower(name) like 'qa %'
   or lower(name) like 'smoke-%'
order by "createdAt" desc;
```

```sql
select id, "customerName", "customerPhone", status, "createdAt"
from "Order"
where lower("customerName") like 'qa %'
   or lower("customerName") like 'cliente-smoke-%'
order by "createdAt" desc;
```

## Regra de seguranca

Antes de qualquer delete, confirme:

- Os registros sao de teste.
- O email usa dominio descartavel ou `example.com`.
- A loja/produto/pedido nao pertence a cliente real.
- Existe backup ou ponto de restauracao recente.

## Recomendacao operacional

Manter os dados de QA enquanto o produto ainda esta em validacao ajuda a auditar os fluxos testados. Quando for limpar, executar em janela controlada e preferir uma rotina transacional revisada caso a quantidade esteja alta.
