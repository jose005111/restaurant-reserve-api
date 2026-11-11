# Contrato da Fase 3

Todas as rotas abaixo usam prefixo `/api`. Staff envia JWT Bearer. O contrato gerado encontra-se em `docs/openapi.json` (`npm run export:openapi`).

| Método               | Rota                              | Roles / resposta                                                                           |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------ |
| POST / GET           | `/categories`                     | ADMIN; cria (201) / lista (200)                                                            |
| GET / PATCH / DELETE | `/categories/:id`                 | ADMIN; detalhe/alteração (200), remoção (204)                                              |
| POST / GET           | `/menu-items`                     | ADMIN; cria (201) / lista (200)                                                            |
| GET / PATCH / DELETE | `/menu-items/:id`                 | ADMIN; detalhe/alteração (200), remoção (204)                                              |
| PATCH                | `/menu-items/:id/availability`    | ADMIN, COUNTER; `{ isAvailable: boolean }` → prato (200)                                   |
| POST                 | `/menu-items/:id/images`          | ADMIN; multipart `file` obrigatório e `altText` opcional → imagem (201)                    |
| PATCH                | `/menu-items/:id/images/reorder`  | ADMIN; `{ imageIds: string[] }` com todos os IDs, sem repetições → imagens ordenadas (200) |
| PATCH                | `/menu-items/:id/images/:imageId` | ADMIN; `{ altText?: string                                                                 | null, isPrimary?: boolean }` → imagem (200) |
| DELETE               | `/menu-items/:id/images/:imageId` | ADMIN; remoção (204); a seguinte assume se era principal                                   |
| GET                  | `/public/menu/:token`             | Público; token de mesa ou genérico (200)                                                   |

Categoria: `id`, `restaurantId`, `name`, `sortOrder`, `isActive`, `createdAt`, `updatedAt`. Criação exige `name`; `sortOrder=0`, `isActive=true`. PATCH aceita os mesmos campos editáveis, todos opcionais. Uma categoria com pratos não pode ser removida (409).

Prato: `id`, `restaurantId`, `categoryId`, `name`, `description`, `priceCents`, `isAvailable`, `sortOrder`, `images[]`, `createdAt`, `updatedAt`. Criação exige `categoryId`, `name`, `priceCents` inteiro ≥0; `description=null`, `isAvailable=true`, `sortOrder=0`. PATCH aceita estes campos editáveis, todos opcionais. Criação respeita `maxMenuItems` (409). Prato com pedidos associados não pode ser removido (409); pode ser marcado indisponível.

Imagem de staff: `id`, `menuItemId`, `url`, `altText`, `sortOrder`, `isPrimary`, `createdAt`. A chave do storage não é exposta. Limite `MAX_MENU_ITEM_IMAGES` (por defeito 5) e `MAX_UPLOAD_BYTES` (por defeito 2 MiB). Conteúdo real JPEG/PNG/WebP, convertido para WebP; não se aceita SVG. A primeira imagem é principal. Marcar outra com `isPrimary: true` troca a principal na mesma transacção; não se pode desmarcar a principal isoladamente com `false` (409). Reorder define os valores `sortOrder=0..N-1`, mantendo a principal.

Campos omitidos em PATCH mantêm o valor. `description` e `altText` aceitam `null`; vazio/espaços normalizam-se para `null`. Campos obrigatórios da BD não aceitam `null`. As listas de categorias e produtos devolvem envelopes paginados `{ items, meta }`; filtros e percurso de todas as páginas estão em [catalog-pagination-contract.md](catalog-pagination-contract.md). Categorias/pratos ordenam-se por `sortOrder`, data e ID; imagens por principal primeiro e depois `sortOrder`, data e ID.

Resposta pública:

```ts
{
  linkType: 'TABLE' | 'GENERIC';
  restaurant: { name: string; slug: string; currency: string; phone: string|null; address: string|null };
  branding: BrandingResponseDto;
  table: { id: string; label: string } | null;
  tables: { id: string; label: string }[];
  categories: {
    name: string;
    items: {
      id: string; // necessário na futura criação de pedidos
      name: string;
      description: string|null;
      priceCents: number;
      images: { url: string; altText: string|null; sortOrder: number; isPrimary: boolean }[];
    }[];
  }[];
}
```

Em TABLE, `table` identifica a mesa e `tables=[]`; em GENERIC, `table=null` e `tables` lista apenas mesas activas. Só entram categorias activas com pelo menos um prato disponível; categorias vazias são omitidas. Não se expõem tokens, IDs de restaurante/categoria/imagem, staff ou chaves de storage. IDs de prato e mesa são necessários ao fluxo público.

Token desconhecido, antigo após rotação ou de mesa inactiva → 404. Restaurante suspenso/expirado → 403. Recurso de outro tenant → 404; role sem acesso → 403. Erros seguem `{ statusCode, message, error, timestamp, path }`; DTO inválido → 400; ficheiro demasiado grande → 413; rate limit → 429.
