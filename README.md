# Restaurant Reserve API

API NestJS de um SaaS multi-tenant de pedidos por QR code. As funcionalidades actuais cobrem as fases 0–7: autenticação de staff, restaurantes, utilizadores, mesas, links/QR, identidade visual, categorias, pratos, imagens, menu público, pedidos públicos, fluxo do balcão, SSE e relatórios.

Requisitos e fases: [docs/base-de-conhecimento.md](docs/base-de-conhecimento.md). Estrutura PostgreSQL: [docs/banco.md](docs/banco.md). O contrato disponível para o frontend está em [docs/openapi.json](docs/openapi.json).

## Preparação

Usa Node.js 22.12+ e PostgreSQL 14+. A base de dados deve existir; utiliza o ambiente PostgreSQL do projecto. Não é necessário criar outro compose.

```bash
npm ci
```

Configura as variáveis no ambiente de execução ou num ficheiro local `.env.dev` (prioritário) / `.env`. Nunca adiciones estes ficheiros ao Git. As ferramentas de migrations e seed carregam `.env.dev`; também aceitam variáveis já exportadas no processo.

| Variável                                                        | Uso / valor por defeito                                                          |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`              | Ligação PostgreSQL; obrigatórias                                                 |
| `DB_PORT`                                                       | `5432`                                                                           |
| `DB_SSL`                                                        | `false`; `true` activa TLS com validação do certificado                          |
| `JWT_SECRET`                                                    | Chave privada de assinatura, com pelo menos 32 caracteres; obrigatória           |
| `JWT_EXPIRE_IN`                                                 | `1d`                                                                             |
| `NODE_ENV`                                                      | `development`, `test` ou `production`                                            |
| `PORT`                                                          | `3000`                                                                           |
| `CORS_ORIGINS`                                                  | Origens separadas por vírgula; sem valor permite qualquer origem                 |
| `PUBLIC_MENU_BASE_URL`                                          | `http://localhost:5173/m`; recebe `/<token>` nos links gerados. Um valor sem `/m` é normalizado. Para QR lido noutro dispositivo, usa uma origem acessível na rede. |
| `ALLOW_PUBLIC_SIGNUP`                                           | `false`; mantém o onboarding reservado ao SUPER_ADMIN                            |
| `STORAGE_DRIVER`                                                | `local`; único driver implementado nesta fase                                    |
| `STORAGE_LOCAL_PATH`                                            | `uploads`; directório onde se guardam e servem os ficheiros                      |
| `STORAGE_PUBLIC_BASE_URL`                                       | `http://localhost:<PORT>/uploads`; em produção usar a URL pública com `/uploads` |
| `MAX_PENDING_ORDERS_PER_TABLE`                                  | `3`; máximo de pedidos PENDING por mesa (1–100), igual para TABLE e GENERIC      |
| `MAX_MENU_ITEM_IMAGES`                                          | `5`; máximo de imagens por prato (1–100)                                         |
| `MAX_UPLOAD_BYTES`                                              | `2097152` (2 MiB), aplicado no multipart antes de carregar o ficheiro completo   |
| `SUPER_ADMIN_NAME`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` | Usadas apenas pelo seed; palavra-passe com pelo menos 8 caracteres               |

Aplica as migrations e cria o utilizador da plataforma com os valores locais configurados:

```bash
npm run migration:run
npm run seed
npm run start:dev
```

O seed cria/actualiza apenas o SUPER_ADMIN. Não contém dados de demonstração de restaurantes. `synchronize` está desactivado: alterações à BD fazem-se sempre por migrations.

## Deploy no Render

Cria um **Web Service** com o directório raiz `restaurant-reserve-api` (se estiveres a usar o repositório do projecto completo):

- **Build Command:** `npm ci --include=dev && npm run build`
- **Start Command:** `npm start` (equivalente a `npm run start:prod`)
- **Health Check Path:** `/api/health`

Configura `NODE_ENV=production`, `JWT_SECRET`, `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` e as restantes variáveis da tabela acima conforme o ambiente. O Render define `PORT`; a aplicação já usa esse valor. Aplica as migrations separadamente antes de servir tráfego. O arranque de produção executa `dist/main.js` e pressupõe que o build terminou com sucesso.

O endpoint de saúde consulta o PostgreSQL. Se a base de dados não estiver acessível, a aplicação pode demorar a iniciar devido às tentativas de ligação do TypeORM, e o health check falha até a ligação estar disponível.

## Rotas e contrato

Todas as rotas têm prefixo `/api`:

- Estado da aplicação/BD: `GET /api/health`.
- Swagger interactivo: `/api/docs`.
- OpenAPI JSON da aplicação: `/api/docs-json`.
- Login: `POST /api/auth/login`; perfil: `GET /api/auth/me`.
- Gestão de restaurantes: `/api/restaurants`, apenas SUPER_ADMIN.
- Staff, mesas e links: `/api/users`, `/api/tables`, `/api/links/generic`.
- Menu: `/api/categories`, `/api/menu-items` e `/api/public/menu/:token`.
- Pedidos do balcão: `/api/orders` (lista, detalhe, aceitação, rejeição e estados); contrato em [docs/phase-5-contract.md](docs/phase-5-contract.md).
- Tempo real: `/api/orders/stream` e `/api/public/orders/:publicCode/stream`; contrato em [docs/phase-6-contract.md](docs/phase-6-contract.md).
- Relatório do restaurante: `GET /api/reports/summary`; contrato e limites em [docs/phase-7-contract.md](docs/phase-7-contract.md).
- Identidade visual: `/api/branding`; consulta pública: `/api/public/branding/:slug`.

Os pedidos de staff usam `Authorization: Bearer <accessToken>`. O ADMIN e COUNTER pertencem a um restaurante. Um restaurante suspenso ou com subscrição expirada impede login, acesso do staff e consulta pública de branding. Os limites de mesas e utilizadores são verificados numa transacção com lock do restaurante; excedê-los devolve 409.

Para exportar o contrato sem iniciar a API, sem credenciais e sem ligação à BD:

```bash
npm run export:openapi
```

O comando recria `docs/openapi.json` a partir dos controllers e DTOs reais. O frontend pode gerar os seus tipos a partir deste ficheiro ou de `/api/docs-json` quando a API estiver a correr. Ao adicionar um novo controller, inclui-o também em `src/export-openapi.ts`.

## Onboarding e branding

`POST /api/restaurants` cria o restaurante e primeiro ADMIN na mesma transacção. O trigger da BD cria imediatamente a linha 1:1 de `restaurant_branding`. Nome do restaurante e nome/email/palavra-passe do administrador são obrigatórios. Slug omitido ou vazio é gerado pelo nome; moeda omitida ou vazia usa `AOA`. Telefone e endereço vazios ficam `null`.

Os defaults de branding seguem a BD:

| Campo                                                         | Valor inicial |
| ------------------------------------------------------------- | ------------- |
| `primaryColor`, `textColor`                                   | `#111827`     |
| `secondaryColor`                                              | `#6B7280`     |
| `accentColor`                                                 | `#F59E0B`     |
| `backgroundColor`                                             | `#FFFFFF`     |
| `surfaceColor`                                                | `#F9FAFB`     |
| `themeMode`                                                   | `LIGHT`       |
| `borderRadius`                                                | `12`          |
| `fontFamily`, textos, redes sociais, WhatsApp e cinco imagens | `null`        |

Em `PATCH /api/branding`, um campo omitido mantém o valor existente. Texto, redes sociais, WhatsApp e fonte aceitam `null`; texto vazio ou só espaços é normalizado para `null`. Cores, tema e raio não aceitam `null` nem vazio. Cores usam `#RRGGBB`, o raio é inteiro entre 0 e 32 e as URLs de redes sociais usam HTTPS. A lista de fontes permitidas está no Swagger, incluindo Inter, Roboto e Open Sans.

Os cinco assets são `logo`, `logo-dark`, `favicon`, `banner` e `login-image`. Alteram-se por `PUT /api/branding/:asset`, multipart com um campo obrigatório `file`; removem-se por `DELETE` da mesma rota (204). A resposta inclui `logoUrl`, `logoDarkUrl`, `faviconUrl`, `bannerUrl` e `loginImageUrl`. Estas URLs não são aceites no PATCH. São aceites JPEG/PNG/WebP pelo conteúdo real; os ficheiros são convertidos para WebP com nome aleatório e o anterior é removido após a actualização.

Exemplos com dados fictícios; define `ACCESS_TOKEN` localmente com um JWT obtido no login:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"replace-with-your-password"}'

curl -X PATCH http://localhost:3000/api/branding \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"primaryColor":"#123456","themeMode":"DARK","fontFamily":"Inter","websiteUrl":""}'

curl -X PUT http://localhost:3000/api/branding/logo \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F 'file=@./logo.png'

curl http://localhost:3000/api/public/branding/example-restaurant
```

As rotações `POST /api/tables/:id/qr/rotate` e `POST /api/links/generic/rotate` devolvem 200. Os links têm tokens aleatórios; uma rotação substitui o token guardado. A resolução pública funciona em `GET /api/public/menu/:token`: token anterior ou de mesa inactiva devolve 404.

Os endpoints públicos têm limite por IP/rota de 60 pedidos por minuto; login tem 10 e signup tem 3. `health` fica excluído. Excesso devolve 429, `Retry-After` e mensagem em português. Os contadores são locais ao processo; múltiplas réplicas precisarão de armazenamento partilhado. O driver local de uploads requer volume persistente em produção.

## Verificação

```bash
npm run build
npm run lint
npm run test -- --runInBand
npm run test:e2e -- --runInBand
npm run export:openapi
```

O lint não altera ficheiros. Os testes usam Jest com suporte ESM para as dependências Nest actuais no Node 22; o Node pode emitir um aviso sobre VM Modules experimental.

Os testes unitários cobrem validação, defaults de onboarding, transacção de criação, isolamento, limites de mesas/pratos e compensação de uploads que falham na BD. Os E2E HTTP usam módulos, guards e serviços reais, com repositórios em memória, chaves JWT de teste e directório temporário. Verificam login/roles/tenant, branding completo, uploads/ficheiros estáticos, QR/rotação, limites, menu público, isolamento de categorias/pratos, imagem principal, ordenação e Swagger, sem ler ficheiros `.env` nem ligar à BD.

Os E2E isolados não validam SQL, triggers, unicidade ou concorrência PostgreSQL. Antes da entrega em produção, aplica as migrations numa BD descartável e valida nela a transacção restaurante/ADMIN/branding e os locks/limites. Relatórios pertencem às fases seguintes.

## Menu e imagens — Fase 3

O contrato detalhado está em [docs/phase-3-contract.md](docs/phase-3-contract.md). O ADMIN gere categorias/pratos e imagens; o COUNTER pode alterar apenas a disponibilidade via `PATCH /api/menu-items/:id/availability`. Preços são inteiros em cêntimos; criar pratos respeita `maxMenuItems`, incluindo os indisponíveis. Categorias com pratos não podem ser removidas; pratos já referenciados por pedidos devolvem 409 e podem ser marcados indisponíveis.

`GET /api/public/menu/:token` resolve tanto o token da mesa como o genérico. TABLE devolve `table` e `tables=[]`; GENERIC devolve `table=null` e a lista de mesas activas. A resposta inclui branding e apenas categorias activas com pratos disponíveis, ordenados por `sortOrder`. Categorias sem pratos disponíveis são omitidas. Não expõe dados do staff, tokens ou chaves de storage.

Cada prato pode receber até `MAX_MENU_ITEM_IMAGES` imagens JPEG/PNG/WebP reais. Upload usa multipart com `file` e `altText` opcional; a primeira imagem torna-se principal. Alterar a principal, reordenar e remover imagens bloqueia o prato na transacção para manter os limites e a unicidade. Reorder exige todos os IDs, sem repetições; as respostas mantêm a principal primeiro. Apagar a principal promove a seguinte por ordem. Um upload cujo registo falhe remove o novo ficheiro; apagar um prato remove também as suas imagens do storage após confirmar a remoção na BD.

```bash
curl -X POST http://localhost:3000/api/categories \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Pratos principais","sortOrder":0}'

curl -X POST http://localhost:3000/api/menu-items \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"categoryId":"replace-with-category-uuid","name":"Calulu","priceCents":250000}'

curl http://localhost:3000/api/public/menu/replace-with-menu-token
```

## Paginação de categorias e produtos

`GET /api/categories` e `GET /api/menu-items` devolvem `{ items, meta: { total, page, limit, totalPages } }`, com `page=1` e `limit=20` por defeito (máximo 100 por página). A BD aplica filtros e paginação; as imagens de produtos são consultadas apenas para a página devolvida. O detalhe, o menu público e as mesas mantêm os contratos existentes.

Ambos aceitam `search` (parte literal do nome, sem distinguir maiúsculas/minúsculas). Categorias aceitam `isActive=true|false`; produtos aceitam `categoryId=<uuid>` e `isAvailable=true|false`. A página fora do intervalo devolve `items=[]` e mantém o total real. Query inválida devolve 400.

O frontend deve reiniciar a página quando mudar filtros e usar `meta` para navegar. Um selector que precise de todas as categorias deve percorrer todas as páginas; pedir `limit=100` não dispensa essa navegação. Exemplos e procedimento completo: [docs/catalog-pagination-contract.md](docs/catalog-pagination-contract.md).

## Pedidos públicos — Fase 4

Contrato completo: [docs/phase-4-contract.md](docs/phase-4-contract.md). `POST /api/public/orders` aceita token, mesa no link genérico, número de pessoas e produtos/quantidades. Não aceita preços: nomes e preços são snapshots calculados no servidor numa transacção com `next_order_number`. `idempotencyKey` é única por restaurante e uma repetição devolve o mesmo pedido. Limites: 50 linhas distintas, quantidade 1–99, pessoas 1–50, total até 2147483647 cêntimos; rate limit de criação 10/min/IP.

`GET /api/public/orders/:publicCode` permite acompanhar o pedido mesmo depois da rotação do QR. `PATCH /api/public/orders/:publicCode/cancel` cancela apenas PENDING (outros estados →409); a resposta é o mesmo detalhe público. Restaurante suspenso/expirado devolve 403 nos três endpoints.

```sh
curl -X POST http://localhost:3000/api/public/orders -H 'Content-Type: application/json' --data '{"token":"<qr-token>","guestsCount":2,"idempotencyKey":"<unique-attempt-id>","items":[{"menuItemId":"<product-uuid>","quantity":2}]}'
curl 'http://localhost:3000/api/public/orders/<public-code>'
curl -X PATCH 'http://localhost:3000/api/public/orders/<public-code>/cancel'
```

Os testes da Fase 4 cobrem snapshots, transacção com rollback/contador, idempotência concorrente, isolamento de produtos/mesas, TABLE/GENERIC, validação, PENDING configurável, tenant indisponível, cancelamento e rate limiting. Concorrência de locks, constraints e execução da função SQL exigem também validação numa instância PostgreSQL descartável. Não foi necessário alterar migrations existentes.
