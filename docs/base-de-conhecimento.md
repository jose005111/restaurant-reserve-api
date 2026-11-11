# API SaaS de Pedidos por QR Code para Restaurantes (NestJS)

# Papel

Actua como arquitecto e programador sénior de backend, especialista em NestJS + TypeScript. Vais desenvolver **apenas a API REST** (sem frontend) de um **SaaS multi-tenant** de pedidos para restaurantes via QR code. A prioridade é **simplicidade e funcionalidade**: nada de microserviços, filas externas ou abstracções desnecessárias.

# Contexto do negócio

1. A plataforma é um **SaaS**: o SUPER_ADMIN (dono da plataforma) regista restaurantes; cada restaurante tem o seu staff, mesas, menu e pedidos, totalmente isolados dos outros.
2. O cliente chega ao restaurante e lê um QR code. O QR abre uma página web (o frontend será feito à parte) que consome esta API.
3. Existem **dois tipos de link/QR**:
   - **Link por mesa:** identifica restaurante e mesa. O cliente não escolhe a mesa.
   - **Link genérico do restaurante:** identifica só o restaurante. O cliente **é obrigado a escolher a mesa** antes de submeter o pedido.
4. O cliente vê o menu do restaurante, escolhe pratos, indica o número de pessoas e observações, e submete o pedido.
5. A API responde "Pedido enviado" e o pedido fica **PENDENTE**.
6. O pedido chega ao **balcão** (painel do staff). O staff valida-o: **aceita** definindo o **tempo estimado de preparo**, ou **rejeita** com motivo (ex.: prato esgotado).
7. O cliente acompanha o estado do pedido (aceite + tempo estimado, a preparar, pronto, entregue).
8. Não há conta nem login para o cliente. O staff autentica-se.

# Stack obrigatória

- NestJS (versão estável actual) + TypeScript em modo `strict`
- TypeORM com **migrations** (nunca `synchronize: true`). Base de dados: **PostgreSQL** (a camada TypeORM deve permitir trocar para Oracle/MySQL sem reescrever a lógica de negócio, por isso evita SQL específico de um motor, salvo onde for indispensável).
- Multi-tenancy: **uma única base de dados, schema partilhado**, isolamento por coluna `restaurantId` (não criar base de dados ou schema por restaurante)
- `class-validator` + `class-transformer` com `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`)
- Autenticação do staff: `@nestjs/jwt` + `passport-jwt`, passwords com `argon2` ou `bcrypt`
- `@nestjs/throttler` (rate limit), `helmet`, CORS configurável por variável de ambiente
- `@nestjs/swagger` para documentação
- `@nestjs/config` com validação das variáveis de ambiente (Zod ou Joi)
- Tempo real: **Server-Sent Events (SSE)** com `@nestjs/event-emitter` + RxJS (mais simples que WebSocket e suficiente: o fluxo é servidor → cliente)
- Geração de QR: pacote `qrcode`
- Upload de ficheiros: `@nestjs/platform-express` (multer) com validação de tipo e tamanho. Armazenamento atrás de uma interface `StorageService` (implementação inicial escolhida por variável de ambiente: disco local em desenvolvimento, storage externo em produção). A base de dados guarda apenas URLs (e a chave do ficheiro nas imagens de pratos).
- Testes: Jest + Supertest (já vêm por defeito no Nest)
- O `docker-compose.yml` da base de dados **já existe**: não o gerar, apenas usar as variáveis de ambiente correspondentes

# Modelo de dados

Valores monetários guardados em **inteiros** (unidade menor da moeda, ex.: cêntimos de Kwanza) para evitar erros de arredondamento. Todas as tabelas com `id` (UUID), `createdAt`, `updatedAt`.

**O ficheiro `docs/banco.md` é a fonte de verdade da estrutura da base de dados.** As entidades TypeORM devem mapeá-lo fielmente (colunas em `snake_case`, chaves estrangeiras compostas `(id, restaurant_id)` incluídas).

- **Restaurant**: name, slug (único), phone, address, currency (default `AOA`), `publicToken` (aleatório, único, ≥ 24 caracteres; link genérico, rotativo), `status` (`ACTIVE` | `SUSPENDED`), `plan` (`FREE` | `BASIC` | `PRO`, default `FREE`), `subscriptionExpiresAt` (nulo = sem expiração), `maxTables`, `maxMenuItems`, `maxUsers` (limites do plano)
- **RestaurantBranding** (1:1 com Restaurant, criado por defeito com o restaurante): `logoUrl`, `logoDarkUrl`, `faviconUrl`, `bannerUrl`, `loginImageUrl`, cores `primaryColor`, `secondaryColor`, `accentColor`, `backgroundColor`, `surfaceColor`, `textColor` (hex `#RRGGBB`), `themeMode` (`LIGHT` | `DARK` | `SYSTEM`), `fontFamily`, `borderRadius`, `welcomeTitle`, `welcomeMessage`, `footerText`, `instagramUrl`, `facebookUrl`, `websiteUrl`, `whatsapp`
- **User** (staff): restaurantId (nulo para SUPER_ADMIN), name, email (único), passwordHash, role (`SUPER_ADMIN` | `ADMIN` | `COUNTER`), isActive
- **DiningTable**: restaurantId, number/label (único por restaurante), `qrToken` (aleatório, não adivinhável, único, ≥ 24 caracteres, rotativo), isActive
- **Category**: restaurantId, name, sortOrder, isActive
- **MenuItem**: restaurantId, categoryId, name, description, priceCents, isAvailable, sortOrder
- **MenuItemImage** (um prato tem 0..N imagens): restaurantId, menuItemId, url, storageKey, altText, sortOrder, isPrimary (no máximo uma principal por prato)
- **Order**: restaurantId, tableId (**sempre preenchido**, mesmo quando vem de link genérico), `number` (sequência diária por restaurante, legível, ex.: #023), `publicCode` (aleatório, para o cliente consultar o pedido), guestsCount, customerNote, status, estimatedPrepMinutes (nulo até ser aceite), acceptedAt, readyAt, deliveredAt, rejectionReason, totalCents, idempotencyKey (único por restaurante)
- **OrderItem**: orderId, menuItemId, **nameSnapshot**, **unitPriceCents (snapshot no momento do pedido)**, quantity, note, lineTotalCents

## Estados do pedido (máquina de estados)

```
PENDING ──accept(tempo)──► ACCEPTED ──► PREPARING ──► READY ──► DELIVERED
   │                          │             │
   ├──reject(motivo)──► REJECTED            └──► CANCELLED (staff)
   └──cancel (cliente, só em PENDING) ──► CANCELLED
```

Regras:

- Transições inválidas devolvem `409 Conflict` com mensagem clara.
- Centraliza as transições numa única função/serviço (tabela de transições permitidas), não espalhes `if`s pelo código.
- `accept` exige `estimatedPrepMinutes` (inteiro 1–240). `reject` exige `reason`.
- Cada mudança de estado emite um evento interno (`order.created`, `order.status_changed`) que alimenta o SSE.

# Endpoints

As rotas abaixo são relativas ao prefixo `/api`. Swagger: `/api/docs`; OpenAPI JSON: `/api/docs-json`.

## Públicos (sem autenticação — cliente)

O `:token` pode ser o `qrToken` de uma mesa **ou** o `publicToken` do restaurante. O servidor resolve qual é e devolve `linkType`.

| Método | Rota                                | Descrição                                                                                                                                                                                                                                                                                                                                                                              |
| ------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/public/menu/:token`               | Resolve o token. Resposta inclui `linkType: "TABLE" \| "GENERIC"`. Se `TABLE`: restaurante, mesa e menu. Se `GENERIC`: restaurante, menu e lista de mesas activas `[{id, label}]` para o cliente escolher. Menu = categorias activas com itens disponíveis, cada um com `images[]` (principal primeiro, depois por `sortOrder`). A resposta inclui sempre o `branding` do restaurante. |
| POST   | `/public/orders`                    | Cria pedido. Body: `token`, `tableId?` (**obrigatório se `linkType = GENERIC`; ignorado se `TABLE`**), `guestsCount`, `customerNote?`, `idempotencyKey`, `items[{menuItemId, quantity, note?}]`. Resposta: `{ publicCode, number, status: "PENDING", message: "Pedido enviado" }`                                                                                                      |
| GET    | `/public/orders/:publicCode`        | Estado actual, itens, total, `estimatedPrepMinutes`, `rejectionReason`                                                                                                                                                                                                                                                                                                                 |
| GET    | `/public/orders/:publicCode/stream` | SSE com as mudanças de estado desse pedido                                                                                                                                                                                                                                                                                                                                             |
| PATCH  | `/public/orders/:publicCode/cancel` | Cancela, apenas se `PENDING`                                                                                                                                                                                                                                                                                                                                                           |
| POST   | `/public/call-waiter`               | (Opcional) Body: `token`, `tableId?` (mesma regra do pedido). Pede atendimento; gera evento para o balcão                                                                                                                                                                                                                                                                              |
| GET    | `/public/branding/:slug`            | Branding do restaurante pelo `slug` (usado no ecrã de login do staff, antes de autenticar). Devolve apenas campos visuais. Respeita o estado do tenant (regra 11).                                                                                                                                                                                                                     |

## Staff (JWT + roles)

| Método | Rota                              | Roles              | Descrição                                                                                                                                                                            |
| ------ | --------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/auth/login`                     | —                  | Devolve access token (e refresh token, se implementado)                                                                                                                              |
| GET    | `/auth/me`                        | todos              | Perfil do utilizador                                                                                                                                                                 |
| CRUD   | `/restaurants`                    | SUPER_ADMIN        | Gestão de restaurantes. `POST` cria o restaurante **e o primeiro ADMIN** numa só transacção (`admin: { name, email, password }`). `PATCH /restaurants/:id/status` suspende/reactiva. |
| CRUD   | `/users`                          | SUPER_ADMIN, ADMIN | Staff do restaurante (respeita `maxUsers`)                                                                                                                                           |
| CRUD   | `/categories`                     | ADMIN              | Categorias                                                                                                                                                                           |
| CRUD   | `/menu-items`                     | ADMIN              | Pratos (respeita `maxMenuItems`); `PATCH /menu-items/:id/availability` também para COUNTER (marcar esgotado rapidamente)                                                             |
| CRUD   | `/tables`                         | ADMIN              | Mesas (respeita `maxTables`); `GET /tables/:id/qr` devolve o QR (PNG ou data URL) com a URL `PUBLIC_MENU_BASE_URL` + `qrToken`                                                       |
| POST   | `/tables/:id/qr/rotate`           | ADMIN              | Gera novo `qrToken` e invalida o anterior                                                                                                                                            |
| GET    | `/links/generic`                  | ADMIN              | Devolve URL e QR do link genérico do restaurante (`PUBLIC_MENU_BASE_URL` + `publicToken`)                                                                                            |
| POST   | `/links/generic/rotate`           | ADMIN              | Gera novo `publicToken` e invalida o anterior                                                                                                                                        |
| GET    | `/orders`                         | ADMIN, COUNTER     | Lista paginada com filtros (`status`, `tableId`, `date`)                                                                                                                             |
| GET    | `/orders/:id`                     | ADMIN, COUNTER     | Detalhe                                                                                                                                                                              |
| PATCH  | `/orders/:id/accept`              | ADMIN, COUNTER     | Body: `estimatedPrepMinutes`, `note?`                                                                                                                                                |
| PATCH  | `/orders/:id/reject`              | ADMIN, COUNTER     | Body: `reason`                                                                                                                                                                       |
| PATCH  | `/orders/:id/status`              | ADMIN, COUNTER     | Body: `status` (`PREPARING`, `READY`, `DELIVERED`, `CANCELLED`)                                                                                                                      |
| GET    | `/orders/stream`                  | ADMIN, COUNTER     | SSE com novos pedidos e mudanças, do restaurante do utilizador                                                                                                                       |
| GET    | `/branding`                       | ADMIN, COUNTER     | Branding do restaurante do utilizador                                                                                                                                                |
| PATCH  | `/branding`                       | ADMIN              | Actualiza cores, tema, fonte, textos e redes sociais (cores validadas como `#RRGGBB`)                                                                                                |
| PUT    | `/branding/:asset`                | ADMIN              | Upload multipart de `logo`, `logo-dark`, `favicon`, `banner` ou `login-image`; substitui e apaga o ficheiro anterior                                                                 |
| DELETE | `/branding/:asset`                | ADMIN              | Remove a imagem de branding indicada                                                                                                                                                 |
| POST   | `/menu-items/:id/images`          | ADMIN              | Upload multipart de uma imagem do prato (respeita o máximo por prato)                                                                                                                |
| PATCH  | `/menu-items/:id/images/reorder`  | ADMIN              | Body: `imageIds[]` pela nova ordem (declarar esta rota antes de `:imageId`)                                                                                                          |
| PATCH  | `/menu-items/:id/images/:imageId` | ADMIN              | Body: `altText?`, `isPrimary?`                                                                                                                                                       |
| DELETE | `/menu-items/:id/images/:imageId` | ADMIN              | Remove a imagem e o ficheiro do storage                                                                                                                                              |
| GET    | `/reports/summary`                | ADMIN              | Pedidos e total por dia, itens mais vendidos (simples)                                                                                                                               |

# Regras de segurança, integridade e tenant (obrigatórias)

1. **Nunca confiar no cliente para preços ou nomes.** O pedido recebe apenas `menuItemId` e `quantity`; o servidor busca o preço, valida que o item pertence ao restaurante resolvido pelo token e está disponível, e grava o snapshot.
2. O token determina o restaurante (e a mesa, no link por mesa). Token desconhecido → `404`. Mesa ou restaurante inactivo → `404`/`403`.
3. **Isolamento por restaurante:** todo o endpoint de staff filtra por `restaurantId` do utilizador autenticado (excepto SUPER_ADMIN). Um ADMIN nunca vê dados de outro restaurante. Cobrir com testes e2e (tenant A não acede a dados do tenant B).
4. **Idempotência:** o mesmo `idempotencyKey` na criação de pedido devolve o pedido já criado em vez de duplicar (cliente com rede instável).
5. **Anti-abuso:** rate limit por IP nos endpoints públicos; limite de `quantity` por item e de itens por pedido; limite de pedidos `PENDING` simultâneos por mesa (configurável, ex.: 3). Aplica-se igual aos dois tipos de link.
6. `publicCode`, `qrToken` e `publicToken` gerados com fonte criptograficamente segura (ex.: `crypto.randomBytes` / `nanoid`).
7. Respostas públicas nunca expõem dados do staff nem IDs internos desnecessários (excepto `tableId` das mesas no link genérico, necessário para o cliente escolher).
8. Criação do pedido + itens + número sequencial numa **transacção**. O número diário deve ser seguro contra concorrência (ex.: tabela contadora com lock, ou `SELECT ... FOR UPDATE`).
9. Erros padronizados via `ExceptionFilter` global: `{ statusCode, message, error, timestamp, path }`.
10. Logs sem dados sensíveis (sem passwords, tokens).
11. **Estado do tenant:** restaurante `SUSPENDED` ou com `subscriptionExpiresAt` ultrapassado → login do staff e todos os endpoints públicos desse restaurante devolvem `403` com "Restaurante indisponível". Implementar num único guard/interceptor, não em cada serviço.
12. **Limites do plano:** criar mesas, pratos e utilizadores valida `maxTables`, `maxMenuItems` e `maxUsers` → `409` com mensagem clara.
13. **Onboarding no MVP:** apenas o SUPER_ADMIN cria restaurantes (com o primeiro ADMIN, em transacção). Auto-registo público fica fora do âmbito.
14. **Link genérico:** `tableId` tem de existir, estar activa e pertencer ao restaurante do token; nunca aceitar texto livre como mesa. Falta de `tableId` num link genérico → `400` "Escolha a mesa".
15. **Rotação de tokens:** após rotação, o token antigo deixa de funcionar imediatamente (`404`). Pedidos já criados continuam consultáveis pelo `publicCode`.
16. **Uploads:** validar o tipo real do ficheiro (magic bytes, não só extensão); aceitar apenas JPEG, PNG e WebP (não aceitar SVG); tamanho máximo configurável (ex.: 2 MB); o nome do ficheiro é gerado pelo servidor (nunca usar o original); caminho no storage `restaurants/{restaurantId}/...`; o ficheiro e o registo na BD têm de ficar consistentes (se um falhar, desfazer o outro).
17. **Imagens de pratos:** máximo configurável por prato (ex.: 5). Há exactamente uma `isPrimary` por prato com imagens: a primeira enviada passa a principal; marcar outra como principal troca-a numa transacção; se a principal for apagada, a seguinte por `sortOrder` assume. Prato que já tenha pedidos não pode ser apagado → `409`, sugerir marcá-lo como indisponível.
18. **Branding:** cores validadas como `#RRGGBB`; `fontFamily` só de uma lista permitida; URLs de redes sociais validadas (`https`). `GET /public/branding/:slug` devolve apenas campos visuais, nunca dados internos.

# Estrutura de pastas sugerida

```
src/
  main.ts
  app.module.ts
  config/                 # env validation, configuração
  common/                 # decorators (@Roles, @CurrentUser), guards (tenant, roles), filters, interceptors
  database/               # data-source, migrations, seeds
  auth/
  users/
  restaurants/            # inclui estado/plano/limites e onboarding
  tables/                 # inclui geração de QR
  links/                  # resolução de token (mesa/genérico) + link genérico
  menu/                   # categories + menu-items + menu-item-images
  branding/               # identidade visual do restaurante
  storage/                # StorageService (interface + implementações)
  orders/
    orders.public.controller.ts
    orders.staff.controller.ts
    orders.service.ts
    order-state-machine.ts
    orders.events.ts
    orders.sse.service.ts
  reports/
test/                     # e2e
```

# Plano de execução por fases

Executa **uma fase de cada vez**. No fim de cada fase: (a) lista os ficheiros criados/alterados, (b) indica como testar (comandos/curl), (c) espera a minha confirmação antes de avançar.

**Fase 0 — Bootstrap.** Projecto Nest, ESLint/Prettier, ligação à BD existente via `@nestjs/config` com validação, TypeORM + primeira migration vazia, Swagger em `/api/docs`, `ValidationPipe` global, helmet, CORS, filtro global de erros, endpoint `GET /health`.
_Critério:_ `npm run start:dev` arranca ligado à BD, `/api/health` responde 200, `/api/docs` abre.

**Fase 1 — Autenticação, utilizadores e tenant.** Entidades Restaurant (com campos SaaS) e User, migration, login JWT, `JwtAuthGuard`, `RolesGuard`, **guard de tenant** (regra 11), decorators `@Roles()` e `@CurrentUser()`, seed do SUPER_ADMIN a partir de variáveis de ambiente.
_Critério:_ login funciona; 401 sem token e 403 com role errada; login de utilizador de restaurante suspenso devolve 403.

**Fase 2 — Restaurantes, mesas e links.** CRUD de restaurantes (SUPER_ADMIN) com criação do primeiro ADMIN e suspensão/reactivação; CRUD de mesas (ADMIN) com validação de `maxTables`; geração de `qrToken` e `publicToken`; endpoints de QR por mesa e de link genérico; rotação de tokens. Inclui o `StorageService` e o módulo `branding` (`GET`/`PATCH /branding`, uploads, `GET /public/branding/:slug`); o branding por defeito é criado com o restaurante.
_Critério:_ criar restaurante+ADMIN numa só chamada; criar mesa e obter QR com o URL correcto; obter link genérico; rodar token invalida o anterior; exceder `maxTables` → 409; actualizar cores e enviar logo, banner e imagem de login funciona; cor inválida → 400; `GET /public/branding/:slug` devolve o branding sem autenticação.

**Fase 3 — Menu.** CRUD de categorias e itens (com `maxMenuItems`), `PATCH availability`, endpoint público `GET /public/menu/:token` tratando os dois tipos de link (`linkType`, lista de mesas no genérico), apenas categorias activas e itens disponíveis, ordenados por `sortOrder`, cada item com `images[]`, e o `branding` do restaurante. Inclui upload, ordenação e imagem principal das imagens dos pratos (regra 17).
_Critério:_ link de mesa devolve a mesa; link genérico devolve a lista de mesas activas; só aparece o que o cliente pode pedir e só do restaurante do token; prato com 2 imagens devolve a principal primeiro; marcar outra como principal troca-a sem violar a unicidade; excesso de imagens e ficheiros inválidos são rejeitados.

**Fase 4 — Criação de pedidos (cliente).** Entidades Order e OrderItem, `POST /public/orders` com todas as regras de segurança, incluindo regra 14 (`tableId` obrigatório no link genérico, ignorado no link de mesa), `GET /public/orders/:publicCode`, cancelamento em PENDING.
_Critério:_ pedido criado com snapshot de preços e total correcto; repetir a mesma `idempotencyKey` não duplica; item de outro restaurante é rejeitado; link genérico sem `tableId` → 400; link genérico com mesa de outro restaurante → rejeitado; testes e2e cobrem estes casos.

**Fase 5 — Fluxo do balcão.** Máquina de estados, `accept` (com tempo estimado), `reject`, `status`, listagem com filtros e paginação, isolamento por restaurante.
_Critério:_ transição inválida → 409; COUNTER de um restaurante não acede a pedidos de outro; testes unitários da máquina de estados.

**Fase 6 — Tempo real (SSE).** Eventos internos `order.created` e `order.status_changed`; `GET /orders/stream` para o balcão (filtrado por restaurante) e `GET /public/orders/:publicCode/stream` para o cliente; heartbeat periódico para manter a ligação viva.
_Critério:_ ao criar um pedido, um cliente SSE do balcão recebe o evento sem recarregar; ao aceitar, o cliente recebe o estado com o tempo estimado; o balcão do restaurante A não recebe eventos do restaurante B.

**Fase 7 — Extras simples.** `call-waiter` (opcional), `GET /reports/summary`, rate limiting afinado por rota, limite de PENDING por mesa, limite de utilizadores (`maxUsers`).
_Critério:_ limites devolvem 429/409 conforme configurado.

**Fase 8 — Qualidade e entrega.** Seeds de demonstração (2 restaurantes para provar o isolamento; no primeiro: 5 mesas, 2 categorias, 8 pratos, utilizadores ADMIN e COUNTER), cobertura e2e do fluxo completo (menu → pedido → aceitar → preparar → pronto → entregue) nos dois tipos de link, `Dockerfile` multi-stage, `README.md` com setup, variáveis de ambiente e exemplos de curl, colecção Postman/Insomnia ou export OpenAPI.
_Critério:_ a partir de um clone limpo, o README permite subir tudo e correr o fluxo completo.

# Formato de entrega

- Para funcionalidades completas (módulo inteiro), entrega **ficheiros completos e prontos a usar**, com o caminho no topo de cada bloco de código.
- Para correcções pequenas, entrega apenas o trecho alterado e indica onde colocá-lo.
- Código e nomes de entidades/rotas em inglês; mensagens de erro e de resposta ao utilizador final em **português**.
- Explica decisões não óbvias em 1–2 linhas; sem teoria desnecessária.
- Se encontrares ambiguidade que bloqueie, faz **uma** pergunta objectiva; caso contrário, assume o mais simples e regista a suposição.

# Fora do âmbito (não implementar)

Frontend, redimensionamento/optimização de imagens, pagamentos e cobrança de subscrições, auto-registo público de restaurantes, entregas ao domicílio, inventário, integração com POS, multi-idioma, notificações push, microserviços, Redis/filas.

Começa pela **Fase 0**.
