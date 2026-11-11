# Paginação do catálogo

Alteração de contrato em `GET /api/categories` e `GET /api/menu-items`: as respostas deixam de ser arrays e passam a `{ items, meta }`. Roles e nomes das rotas mantêm-se. Os restantes endpoints, incluindo mesas e menu público, mantêm o contrato existente.

## Query

| Parâmetro     | Categorias | Produtos (`menu-items`) | Regras                                                                                                                           |
| ------------- | ---------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `page`        | sim        | sim                     | Inteiro 1–1000000; por defeito 1                                                                                                 |
| `limit`       | sim        | sim                     | Inteiro 1–100; por defeito 20                                                                                                    |
| `search`      | sim        | sim                     | Parte literal do nome, sem distinguir maiúsculas/minúsculas; máximo 100 caracteres; espaços exteriores removidos, vazio ignorado |
| `isActive`    | sim        | não                     | Apenas `true` ou `false`; omitido inclui ambos                                                                                   |
| `categoryId`  | não        | sim                     | UUID; categoria de outro restaurante ou inexistente produz página vazia                                                          |
| `isAvailable` | não        | sim                     | Apenas `true` ou `false`; omitido inclui ambos                                                                                   |

Os filtros combinam-se com AND e sempre com o `restaurantId` do utilizador. `search` trata `%`, `_` e `\` como caracteres literais. Ordenação estável: `sortOrder ASC, createdAt ASC, id ASC`. A BD aplica filtros e `skip/take` (offset/limit); não se carrega todo o catálogo para o cortar em memória. As imagens de produtos são carregadas apenas para os produtos da página.

## Envelope

```ts
{
  items: CategoryResponseDto[] | MenuItemResponseDto[];
  meta: {
    total: number;      // total filtrado antes da paginação
    page: number;       // página pedida
    limit: number;
    totalPages: number; // ceil(total / limit); 0 quando não há resultados
  };
}
```

Uma página posterior à última devolve `items=[]`, mantendo a página pedida e o total real. Parâmetros inválidos, filtros desconhecidos, `page=0`, `limit>100` ou booleanos diferentes de `true/false` devolvem 400 no formato de erro habitual. Os detalhes de categoria/produto mantêm os DTOs anteriores.

Exemplos:

```http
GET /api/categories?page=1&limit=20&search=pratos&isActive=true
GET /api/menu-items?page=2&limit=20&categoryId=<uuid>&isAvailable=false&search=calulu
```

## Selector de categorias sem truncagem

Pedir `limit=100` não significa que todas as categorias tenham sido devolvidas. O selector deve percorrer todas as páginas, ou oferecer pesquisa e carregamento de páginas ao utilizador. Para recolher o conjunto completo:

```ts
const categories: CategoryResponseDto[] = [];
for (let page = 1; ; page++) {
  const result = await getCategories({ page, limit: 100 });
  categories.push(...result.items);
  if (page >= result.meta.totalPages) break;
}
```

Mantém os mesmos filtros em todas as páginas e reinicia em `page=1` quando os filtros mudam. Para editar produtos que já pertencem a categorias inactivas, o selector deve também conseguir apresentar a categoria actualmente seleccionada; não deve limitar-se silenciosamente à primeira página nem filtrar `isActive=true` sem essa preocupação. O detalhe `GET /api/categories/:id` continua disponível.
