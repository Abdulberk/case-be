# Frontend Implementation Plan

This backend exposes a single GraphQL endpoint at `http://localhost:4000/graphql`.
The frontend should be a separate Next.js App Router app and should not perform
client-only filtering.

## GraphQL Operation

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

## URL State Contract

- `q`: maps to `filter.search`.
- `status`: maps to `filter.status`; allowed values are `ALIVE`, `DEAD`, `UNKNOWN`.
- `gender`: maps to `filter.gender`; allowed values are `MALE`, `FEMALE`, `UNKNOWN`.
- `page`: one-based page number.
- Use `take = 12`.
- Compute `skip = (page - 1) * take`.
- Reset `page` to `1` whenever `q`, `status`, or `gender` changes.

## Recommended Frontend Stack

- Next.js App Router.
- `@tanstack/react-query` for fetching, cache, loading states, and error states.
- `nuqs` for query parameter state.
- GraphQL Code Generator with `typescript`, `typescript-operations`, and a React Query
  plugin or typed SDK generation.

## UI Behavior

- Render a responsive card grid.
- Each card shows image, name, status, gender, and a short description.
- Search input updates `q` in the URL and refetches via React Query variables.
- Status and gender selectors write enum values to the URL.
- Empty filters should be omitted from the GraphQL variables.
- Show explicit loading, empty, and error states.
