# restaurant-reserve-api (NestJS)

API REST de um SaaS de pedidos por QR code. Fonte de verdade:

- `docs/base-de-conhecimento.md`: requisitos, endpoints, regras e fases
- `docs/banco.md`: estrutura da base de dados

## Stack

NestJS + TypeScript `strict`, TypeORM, PostgreSQL, JWT (passport-jwt), class-validator,
Swagger, throttler, SSE com `@nestjs/event-emitter` + RxJS, Jest + Supertest.

## Regras que nunca se quebram

- Migrations sempre; nunca `synchronize: true`. As entidades mapeiam `docs/banco.md` em `snake_case`.
- Isolamento por restaurante: todo o endpoint de staff filtra por `restaurantId` do utilizador (excepto SUPER_ADMIN).
- O cliente nunca envia preços: o servidor calcula e grava snapshot em `order_items`.
- Valores monetários em inteiros (cêntimos).
- Criação de pedido, itens e número diário numa transacção (`next_order_number`).
- Transições de estado do pedido só pela máquina de estados central; inválidas devolvem 409.
- Uploads: validar tipo real (JPEG/PNG/WebP), tamanho máximo, nome gerado pelo servidor.
- Erros no formato `{ statusCode, message, error, timestamp, path }`; mensagens ao utilizador em português.
- Todo o DTO e endpoint com decorators do Swagger (`@ApiProperty`, `@ApiResponse`), porque o frontend gera tipos a partir do `/api/docs-json`.

## Trabalho por fases

Segue as fases de `docs/base-de-conhecimento.md`, uma de cada vez. No fim de cada fase: ficheiros alterados, como testar (comandos/curl) e se o contrato mudou.

## Comandos

`npm run start:dev`, `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`.
Para migrations usa os scripts definidos no `package.json`.
