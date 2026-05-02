# case-be

Character Management GraphQL API built with NestJS, Prisma, and PostgreSQL.

## Requirements

- Node.js 22+
- npm
- Docker

## Local setup

```bash
npm install
copy .env.example .env
docker compose up -d
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

GraphQL runs at:

```text
http://localhost:4000/graphql
```

Health check:

```text
GET http://localhost:4000/health
```

## Docker build

```bash
docker build -t case-be .
docker run -p 4000:4000 --env-file .env case-be
```

## Useful scripts

```bash
npm run build
npm run lint
npm run test
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

## GraphQL query

```graphql
query Characters($filter: CharactersFilterInput, $pagination: PaginationInput) {
  characters(filter: $filter, pagination: $pagination) {
    items {
      id
      image
      name
      status
      gender
      description
    }
    totalCount
    pageInfo {
      skip
      take
      hasNextPage
    }
  }
}
```

Filters are applied server-side. `search` is matched case-insensitively against
`name` and `description`. Pagination defaults to `skip = 0`, `take = 20`, and
`take` is capped at `50`.

## Frontend contract

See [docs/frontend-implementation-plan.md](docs/frontend-implementation-plan.md).
