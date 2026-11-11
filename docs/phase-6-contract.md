# Fase 6 — Eventos em tempo real

Os endpoints SSE usam `Content-Type: text/event-stream` e enviam um evento `connected` ao abrir a ligação. Enviam `heartbeat` a cada 20 segundos para manter a ligação viva. Ambos estão descritos no OpenAPI, exportável com `npm run export:openapi`.

## Balcão

`GET /api/orders/stream` exige `Authorization: Bearer <JWT>` de ADMIN ou COUNTER. Recebe apenas eventos do restaurante associado ao utilizador. `order.created` é enviado depois da criação do pedido; `order.status_changed` depois de qualquer alteração de estado, incluindo cancelamento público. O campo `data` contém `orderId`, `status` e `estimatedPrepMinutes`. O cliente deve consultar novamente `/api/orders` ou `/api/orders/:id` para obter os detalhes completos.

## Cliente

`GET /api/public/orders/:publicCode/stream` não exige JWT. O código público deve existir e o restaurante estar disponível; caso contrário, a ligação é recusada. Recebe apenas `order.status_changed` do pedido correspondente. A resposta inclui apenas `status` e `estimatedPrepMinutes`. O cliente deve consultar novamente `/api/public/orders/:publicCode` para obter o detalhe actualizado.

Exemplo de evento:

```text
event: order.status_changed
data: {"orderId":"<uuid>","status":"ACCEPTED","estimatedPrepMinutes":25}

```

Os eventos são emitidos após a confirmação da transacção. Repetir uma criação com a mesma chave de idempotência não gera outro `order.created`. As ligações removem os seus listeners ao fechar. O bus de eventos vive no processo da API; para usar várias réplicas, será necessário um broker partilhado. Em caso de perda de ligação, os clientes devem consultar o estado actual porque o stream não guarda eventos anteriores.
