# Fase 5 — Fluxo do balcão

Todas as rotas usam o prefixo `/api`, JWT e as roles `ADMIN` ou `COUNTER`. O restaurante vem do utilizador autenticado; pedidos de outro restaurante devolvem 404 em detalhe e mutações e nunca aparecem na lista.

## Consultar

- `GET /orders`: `{ items, meta: { total, page, limit, totalPages } }`. Filtros opcionais: `status`, `tableId` (UUID), `date` (`YYYY-MM-DD`, data do pedido em Africa/Luanda). `page=1`, `limit=20` por defeito; limite máximo 100. A ordenação é por criação descendente, com ID como desempate. Cada item inclui linhas do pedido e mesa.
- `GET /orders/:id`: o mesmo detalhe de um pedido, identificado por UUID.

O detalhe inclui `id`, `tableId`, `tableLabel`, `number`, `orderDate`, `status`, `guestsCount`, `customerNote`, `items[]` (snapshots de nome, preço, quantidade e nota), `totalCents`, `estimatedPrepMinutes`, `staffNote`, `rejectionReason` e datas de criação/actualização/aceitação/pronto/entrega/cancelamento. Não expõe `publicCode` nem `idempotencyKey`.

## Transições

As alterações bloqueiam a linha do pedido numa transacção e passam pela mesma máquina de estados usada no cancelamento público. Transições inválidas devolvem 409.

| Rota | Body | Transição |
| --- | --- | --- |
| `PATCH /orders/:id/accept` | `{ "estimatedPrepMinutes": 20, "note": "opcional" }` | `PENDING → ACCEPTED`; tempo inteiro de 1 a 240 minutos. |
| `PATCH /orders/:id/reject` | `{ "reason": "Prato esgotado" }` | `PENDING → REJECTED`; motivo obrigatório, 1 a 255 caracteres. |
| `PATCH /orders/:id/status` | `{ "status": "PREPARING" }` | `ACCEPTED → PREPARING → READY → DELIVERED`; `ACCEPTED` e `PREPARING` também podem passar a `CANCELLED`. |

Cada mutação devolve o detalhe actualizado. `acceptedAt`, `readyAt`, `deliveredAt` e `cancelledAt` são preenchidos na transição correspondente. O cliente continua a poder cancelar apenas em `PENDING`.

Exemplo com valores fictícios:

```sh
curl 'http://localhost:3000/api/orders?status=PENDING&page=1&limit=20' -H "Authorization: Bearer $ACCESS_TOKEN"
curl -X PATCH 'http://localhost:3000/api/orders/<order-uuid>/accept' -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' -d '{"estimatedPrepMinutes":20}'
```

O SSE fica para a Fase 6. Nesta fase, o painel consulta a fila periodicamente e permite actualização manual.
