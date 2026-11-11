# Fase 7 — Relatórios e limites

## GET /api/reports/summary

Exige JWT de `ADMIN` e usa apenas os pedidos do restaurante do utilizador. Os parâmetros opcionais `from` e `to` usam `YYYY-MM-DD` e a data de negócio em Africa/Luanda. Sem parâmetros, o período são os últimos sete dias, incluindo hoje. O período deve ter entre 1 e 31 dias; intervalos invertidos ou maiores devolvem 400.

A resposta tem `from`, `to`, `currency`, `ordersCount`, `salesCents`, `days[]` e `topItems[]`:

- `ordersCount` conta todos os pedidos do período, incluindo pendentes, rejeitados e cancelados.
- `salesCents` soma apenas pedidos `ACCEPTED`, `PREPARING`, `READY` ou `DELIVERED`. É um valor em cêntimos.
- Cada entrada de `days[]` tem `date`, `ordersCount` e `salesCents`; dias sem pedidos aparecem com zero.
- `topItems[]` contém até dez combinações de `menuItemId` e `nameSnapshot`, ordenadas por quantidade vendida, depois valor. Cada entrada tem `quantity` e `salesCents`. Apenas linhas de pedidos incluídos nas vendas entram nesta lista.

```sh
curl 'http://localhost:3000/api/reports/summary?from=2026-11-01&to=2026-11-10' -H "Authorization: Bearer $ACCESS_TOKEN"
```

## Limites já aplicados

`MAX_PENDING_ORDERS_PER_TABLE` (1–100, por defeito 3) limita pedidos `PENDING` por mesa, tanto em links TABLE como GENERIC. O limite do plano `maxUsers` é verificado ao criar staff. Exceder qualquer um devolve 409. O rate limiting público por IP e rota é de 60 pedidos por minuto por defeito; criação de pedido e login usam 10/min, signup usa 3/min. Exceder devolve 429 com `Retry-After`. `GET /health` está excluído. Os contadores são locais ao processo e precisam de armazenamento partilhado se houver várias réplicas.

`POST /public/call-waiter` continua opcional e não faz parte desta entrega.
