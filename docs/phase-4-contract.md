# Fase 4 — Pedidos públicos

Rotas relativas a `/api`; sem autenticação. OpenAPI: `/api/docs-json`, export offline: `npm run export:openapi`. Não inclui balcão nem SSE.

## Criar — POST /public/orders

Body `CreatePublicOrderDto`:

- `token`: string não vazia, máximo 255, token actual TABLE ou GENERIC.
- `tableId?`: obrigatório UUID no link GENERIC; completamente ignorado no TABLE (mesmo que inválido). A mesa deve estar activa e pertencer ao restaurante.
- `guestsCount`: inteiro 1–50.
- `customerNote?`: texto, máximo 500; branco é convertido em null.
- `idempotencyKey`: string não vazia, máximo 100, gerada pelo cliente e reutilizada nas tentativas do mesmo pedido.
- `items`: 1–50 linhas `CreatePublicOrderItemDto` com `menuItemId` UUID, `quantity` inteiro 1–99 e `note?` texto até 255 (branco vira null). Não são permitidos IDs de produto repetidos. Preços/nomes enviados pelo cliente são rejeitados.

Resposta 201 `CreatePublicOrderResponseDto`: `{ publicCode, number, status, message: "Pedido enviado" }`. `publicCode` aleatório criptográfico de 32 caracteres. A primeira criação fica PENDING; repetição da chave no mesmo restaurante devolve o código, número e estado actual do pedido existente, sem alterar dados, mesmo que o payload seja diferente. O cliente deve gerar uma chave nova para cada novo pedido. A validação estrutural do body e do token actual continua a aplicar-se.

Nomes/preços são snapshots do servidor; só produtos disponíveis, da categoria activa e do mesmo restaurante são aceites. Total máximo 2147483647 cêntimos (limite integer do schema). Contador diário `next_order_number` e `orderDate` usam Africa/Luanda, na mesma transacção que pedido/linhas. Lock do restaurante serializa criações e idempotência por tenant; lock da mesa protege o limite simultâneo.

`MAX_PENDING_ORDERS_PER_TABLE` configurável (1–100, default 3), igual para TABLE e GENERIC; uma repetição idempotente não consome limite. Cancelar liberta a capacidade. Rate limit público por IP existente (60/min por rota) e criação 10/min por IP.

## Consultar — GET /public/orders/:publicCode

200 `PublicOrderResponseDto`: `publicCode`, `number`, `orderDate`, `status`, `restaurantName`, `currency`, `tableLabel`, `guestsCount`, `customerNote`, `items[]` (`nameSnapshot`, `unitPriceCents`, `quantity`, `note`, `lineTotalCents`), `totalCents`, `estimatedPrepMinutes`, `rejectionReason`, `createdAt`, `acceptedAt`, `readyAt`, `deliveredAt`, `cancelledAt`. Campos sem valor são null. Não expõe IDs internos, chave de idempotência, notas de staff ou tokens. Código funciona após rotação de QR.

## Cancelar — PATCH /public/orders/:publicCode/cancel

Sem body. 200 devolve `PublicOrderResponseDto`. Apenas PENDING→CANCELLED pela máquina de estados central, com lock do pedido; repetição/qualquer outro estado →409. Não há endpoints de staff nesta fase.

## Erros

Formato habitual `{ statusCode, message, error, timestamp, path }`. 400: body, mesa genérica ausente, produto repetido/indisponível/de outro tenant ou total fora do limite. 403: restaurante suspenso/expirado ("Restaurante indisponível"). 404: token, código ou mesa activa inexistente/do outro tenant. 409: limite PENDING ou transição inválida. 429: rate limit. Todos documentados no Swagger.

Usa migrations existentes: orders/order_items/order_counters/função já constam do schema inicial; não altera o schema.
