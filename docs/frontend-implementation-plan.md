# Frontend Implementation Plan

This backend exposes a single GraphQL endpoint. The frontend should be a
**separate Next.js App Router** application. All filtering, searching, and
pagination **must** be handled server-side via the GraphQL API — no client-side
filtering.

---

## Backend API

- **GraphQL endpoint:** `http://localhost:4000/graphql`
- **Method:** `POST`
- **Health check:** `GET http://localhost:4000/health`
- **Rate limit:** 100 requests per minute per client

---

## Authentication & Authorization

The backend uses **JWT-based authentication** with **role-based authorization**.

### Roles

| Role | Access |
|---|---|
| **Public** (no auth) | `characters`, `character(id)`, `characterStats` queries |
| **USER** | All public endpoints + `me` query |
| **ADMIN** | All USER endpoints + `createCharacter`, `updateCharacter`, `deleteCharacter` mutations |

### Auth Flow

1. **Register** → `register` mutation → returns `{ accessToken, user }`
2. **Login** → `login` mutation → returns `{ accessToken, user }`
3. **Authenticated requests** → include `Authorization: Bearer <token>` header
4. **Get current user** → `me` query (requires valid JWT)

### Auth Mutations & Queries

```graphql
type Mutation {
  register(input: RegisterInput!): AuthResponse!
  login(input: LoginInput!): AuthResponse!
}

type Query {
  me: User!   # Requires JWT token
}

input RegisterInput {
  email: String!      # Valid email
  password: String!   # Min 6 characters
  name: String!       # Required
}

input LoginInput {
  email: String!      # Valid email
  password: String!
}

type AuthResponse {
  accessToken: String!
  user: User!
}

type User {
  id: ID!
  email: String!
  name: String!
  role: UserRole!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum UserRole {
  USER
  ADMIN
}
```

### Error Responses

| Scenario | Error Message |
|---|---|
| Register with existing email | `"Email already registered"` |
| Login with wrong credentials | `"Invalid email or password"` |
| Request without token (protected endpoint) | `"Unauthorized"` |
| USER tries admin mutation | `"You do not have permission to perform this action"` |
| Token expired or invalid | `"Unauthorized"` |

---

## GraphQL Schema

### Queries

The backend exposes **4 queries:**

```graphql
type Query {
  character(id: ID!): Character!           # Public
  characters(...): CharacterConnection!     # Public
  characterStats: CharacterStats!           # Public
  me: User!                                 # Authenticated (any role)
}
```

### Mutations

The backend exposes **5 mutations:**

```graphql
type Mutation {
  # Auth (Public — no token needed)
  register(input: RegisterInput!): AuthResponse!
  login(input: LoginInput!): AuthResponse!

  # Admin (Requires JWT with ADMIN role)
  createCharacter(input: CreateCharacterInput!): Character!
  updateCharacter(id: ID!, input: UpdateCharacterInput!): Character!
  deleteCharacter(id: ID!): DeleteResult!
}
```

### Input Types

```graphql
# ── Query Inputs ──

input CharactersFilterInput {
  status: CharacterStatus    # optional
  gender: CharacterGender    # optional
  search: String             # optional, max 120 chars, case-insensitive match on name + description
}

input PaginationInput {
  skip: Int = 0    # min 0
  take: Int = 20   # min 1, max 50 (capped server-side)
}

input CharacterSortInput {
  field: CharacterSortField = NAME
  direction: SortDirection = ASC
}

# ── Auth Inputs ──

input RegisterInput {
  email: String!      # valid email
  password: String!   # min 6 characters
  name: String!       # required
}

input LoginInput {
  email: String!      # valid email
  password: String!
}

# ── Admin Mutation Inputs ──

input CreateCharacterInput {
  name: String!            # min 2, max 100 chars
  image: String!           # must be a valid URL
  status: CharacterStatus  # default: UNKNOWN
  gender: CharacterGender  # default: UNKNOWN
  description: String!     # min 10, max 500 chars
}

input UpdateCharacterInput {
  name: String             # optional, min 2, max 100 chars
  image: String            # optional, must be a valid URL
  status: CharacterStatus  # optional
  gender: CharacterGender  # optional
  description: String      # optional, min 10, max 500 chars
}
```

### Enums

```graphql
enum CharacterStatus {
  ALIVE
  DEAD
  UNKNOWN
}

enum CharacterGender {
  MALE
  FEMALE
  UNKNOWN
}

enum CharacterSortField {
  NAME
  STATUS
  GENDER
}

enum SortDirection {
  ASC
  DESC
}

enum UserRole {
  USER
  ADMIN
}
```

### Response Types

```graphql
type CharacterConnection {
  items: [Character!]!
  totalCount: Int!
  pageInfo: PageInfo!
}

type Character {
  id: ID!
  image: String!        # Avatar URL (https://i.pravatar.cc/512?u=...)
  name: String!
  status: CharacterStatus!
  gender: CharacterGender!
  description: String!
}

type PageInfo {
  skip: Int!
  take: Int!
  hasNextPage: Boolean!
}

type CharacterStats {
  totalCount: Int!
  byStatus: [StatusCount!]!
  byGender: [GenderCount!]!
}

type StatusCount {
  status: CharacterStatus!
  count: Int!
}

type GenderCount {
  gender: CharacterGender!
  count: Int!
}

type DeleteResult {
  id: ID!
  success: Boolean!
}

type AuthResponse {
  accessToken: String!
  user: User!
}

type User {
  id: ID!
  email: String!
  name: String!
  role: UserRole!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

---

## Required Tech Stack

| Tool | Purpose |
|---|---|
| **Next.js** (App Router) | Framework, routing |
| **GraphQL** | API communication |
| **GraphQL Code Generator** | Generate typed queries, hooks, and TypeScript types from the schema |
| **@tanstack/react-query** | Data fetching, caching, loading/error states |
| **nuqs** | Sync filter/search/page state with URL query parameters |

---

## GraphQL Code Generator Setup

Create `codegen.ts` at the project root:

```typescript
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'http://localhost:4000/graphql',
  documents: ['src/**/*.graphql', 'src/**/*.ts'],
  generates: {
    'src/generated/graphql.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-react-query',
      ],
      config: {
        reactQueryVersion: 5,
        fetcher: {
          func: '../lib/graphql-fetcher#fetcher',
        },
        exposeQueryKeys: true,
        exposeFetcher: true,
      },
    },
  },
};

export default config;
```

Required dev dependencies:

```bash
npm install -D @graphql-codegen/cli @graphql-codegen/typescript @graphql-codegen/typescript-operations @graphql-codegen/typescript-react-query
```

Add script to `package.json`:

```json
{
  "scripts": {
    "codegen": "graphql-codegen --config codegen.ts"
  }
}
```

### GraphQL Fetcher (`src/lib/graphql-fetcher.ts`)

The fetcher automatically includes the JWT token from localStorage when available:

```typescript
const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql';

export function fetcher<TData, TVariables>(
  query: string,
  variables?: TVariables,
): () => Promise<TData> {
  return async () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Include JWT token if available
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('accessToken')
      : null;

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    const json = await response.json();

    if (json.errors) {
      const message = json.errors.map((e: { message: string }) => e.message).join(', ');

      // Handle auth errors
      if (message.includes('Unauthorized')) {
        // Clear token and redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }

      throw new Error(message);
    }

    return json.data;
  };
}
```

### Query Documents (`src/graphql/`)

**`characters.graphql`** — Character list with filters, pagination, and sorting:

```graphql
query Characters($filter: CharactersFilterInput, $pagination: PaginationInput, $sort: CharacterSortInput) {
  characters(filter: $filter, pagination: $pagination, sort: $sort) {
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

**`character.graphql`** — Single character detail by ID:

```graphql
query Character($id: ID!) {
  character(id: $id) {
    id
    image
    name
    status
    gender
    description
  }
}
```

**`character-stats.graphql`** — Aggregate statistics for dashboard:

```graphql
query CharacterStats {
  characterStats {
    totalCount
    byStatus {
      status
      count
    }
    byGender {
      gender
      count
    }
  }
}
```

### Auth Query & Mutation Documents (`src/graphql/`)

**`register.graphql`** — User registration:

```graphql
mutation Register($input: RegisterInput!) {
  register(input: $input) {
    accessToken
    user {
      id
      email
      name
      role
    }
  }
}
```

**`login.graphql`** — User login:

```graphql
mutation Login($input: LoginInput!) {
  login(input: $input) {
    accessToken
    user {
      id
      email
      name
      role
    }
  }
}
```

**`me.graphql`** — Get current user:

```graphql
query Me {
  me {
    id
    email
    name
    role
    createdAt
    updatedAt
  }
}
```

### Admin Mutation Documents (`src/graphql/`)

**`create-character.graphql`** — Create a new character:

```graphql
mutation CreateCharacter($input: CreateCharacterInput!) {
  createCharacter(input: $input) {
    id
    image
    name
    status
    gender
    description
  }
}
```

**`update-character.graphql`** — Update an existing character:

```graphql
mutation UpdateCharacter($id: ID!, $input: UpdateCharacterInput!) {
  updateCharacter(id: $id, input: $input) {
    id
    image
    name
    status
    gender
    description
  }
}
```

**`delete-character.graphql`** — Delete a character:

```graphql
mutation DeleteCharacter($id: ID!) {
  deleteCharacter(id: $id) {
    id
    success
  }
}
```

---

## Auth Context & State Management

### Auth Store (`src/lib/auth-store.ts`)

```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

// Store token and user in localStorage
export function setAuth(accessToken: string, user: User) {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('user', JSON.stringify(user));
}

export function getAuth(): AuthState {
  if (typeof window === 'undefined') {
    return { user: null, token: null, isAuthenticated: false, isAdmin: false };
  }

  const token = localStorage.getItem('accessToken');
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  return {
    user,
    token,
    isAuthenticated: !!token,
    isAdmin: user?.role === 'ADMIN',
  };
}

export function clearAuth() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
}
```

### Auth Hook (`src/hooks/use-auth.ts`)

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { setAuth, clearAuth, getAuth } from '../lib/auth-store';

export function useAuth() {
  const queryClient = useQueryClient();
  const auth = getAuth();

  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) =>
      fetcher(LOGIN_MUTATION, { input })(),
    onSuccess: (data) => {
      setAuth(data.login.accessToken, data.login.user);
      queryClient.invalidateQueries();
    },
  });

  const registerMutation = useMutation({
    mutationFn: (input: RegisterInput) =>
      fetcher(REGISTER_MUTATION, { input })(),
    onSuccess: (data) => {
      setAuth(data.register.accessToken, data.register.user);
      queryClient.invalidateQueries();
    },
  });

  const logout = () => {
    clearAuth();
    queryClient.clear();
    window.location.href = '/';
  };

  return {
    ...auth,
    login: loginMutation,
    register: registerMutation,
    logout,
  };
}
```

---

## URL State Contract (nuqs)

| URL Param | Maps to | Type | Notes |
|---|---|---|---|
| `q` | `filter.search` | `string` | Free text, debounced ~300ms |
| `status` | `filter.status` | `CharacterStatus` | `ALIVE`, `DEAD`, or `UNKNOWN` |
| `gender` | `filter.gender` | `CharacterGender` | `MALE`, `FEMALE`, or `UNKNOWN` |
| `page` | pagination calculation | `number` | 1-based page number, default `1` |
| `sort` | `sort.field` | `CharacterSortField` | `NAME`, `STATUS`, or `GENDER` |
| `dir` | `sort.direction` | `SortDirection` | `ASC` or `DESC` |

### Pagination Logic

- Use `take = 12` (cards per page).
- Compute `skip = (page - 1) * 12`.
- Compute total pages: `Math.ceil(totalCount / 12)`.
- **Reset `page` to `1`** whenever `q`, `status`, or `gender` changes.

### Building GraphQL Variables from URL

```typescript
// Omit undefined/null values from filter — don't send empty filters
const variables = {
  filter: {
    ...(q ? { search: q } : {}),
    ...(status ? { status } : {}),
    ...(gender ? { gender } : {}),
  },
  pagination: {
    skip: (page - 1) * 12,
    take: 12,
  },
  sort: {
    field: sort || 'NAME',
    direction: dir || 'ASC',
  },
};

// If filter object is empty, omit it entirely or pass undefined
```

---

## UI Requirements

### Layout

- Clean, modern, responsive design.
- Use a **card grid** layout (e.g., CSS Grid or Tailwind grid).
- Suggested: 1 column mobile, 2 columns tablet, 3-4 columns desktop.
- **Navigation bar** with: logo/title, user info (if logged in), login/register/logout buttons.

### Stats Dashboard (top of page, optional but impressive)

Use `characterStats` query to show a summary bar above filters:
- Total characters count
- Status breakdown (e.g., "10 Alive · 8 Dead · 6 Unknown")
- Gender breakdown
- Can be simple badges, small bar chart, or number cards.

### Character Card

Each card must display:

| Field | Display |
|---|---|
| `image` | Avatar image (square, rounded) |
| `name` | Character name (bold/prominent) |
| `status` | Badge/chip: `Alive` (green), `Dead` (red), `Unknown` (gray) |
| `gender` | Badge/chip or text label |
| `description` | Short text, truncated if needed |

Cards should be **clickable** — navigate to a detail view (or show a modal) using
the `character(id)` query.

### Character Detail View

When a card is clicked, show full character details using:

```graphql
query Character($id: ID!) {
  character(id: $id) { ... }
}
```

Options:
- **Option A:** A modal/dialog overlay (simpler, stays on same page)
- **Option B:** A separate page `/characters/[id]` using Next.js dynamic routes

Handle the **not found** case — the backend returns a GraphQL error with
`"Character with id "..." not found"` if the ID doesn't exist.

### Filter Bar (above the grid)

- **Search input:** Text input for `q`, with debounce (~300ms). Placeholder: "Search characters..."
- **Status dropdown:** Options: `All` (clears filter), `Alive`, `Dead`, `Unknown`
- **Gender dropdown:** Options: `All` (clears filter), `Male`, `Female`, `Unknown`
- **Sort dropdown:** Options: `Name`, `Status`, `Gender` — maps to `CharacterSortField`
- **Sort direction toggle:** ASC/DESC button or icon toggle
- All filter/sort changes update URL via nuqs and trigger React Query refetch.

### Pagination (below the grid)

- Show current page and total pages.
- Previous / Next buttons.
- Disable Previous on page 1, disable Next when `hasNextPage` is false.

### Auth Pages

#### Login Page (`/login`)

- Email + password form
- "Don't have an account? Register" link
- Error display for wrong credentials
- Redirect to home after successful login

#### Register Page (`/register`)

- Name + email + password form
- "Already have an account? Login" link
- Error display for duplicate email, validation errors
- Redirect to home after successful registration

#### Protected Routes

- Admin panel (`/admin`) — redirect to login if not authenticated or not ADMIN
- Use middleware or a layout wrapper to check auth state

### States

| State | UI |
|---|---|
| **Loading** | Skeleton cards or spinner |
| **Empty** | "No characters found" message with suggestion to clear filters |
| **Error** | Error message with retry button |
| **Data** | Card grid with pagination |
| **Unauthorized** | Redirect to login page |
| **Forbidden** | "Access denied" message |

---

## Suggested Project Structure

```
case-fe/
├── src/
│   ├── app/
│   │   ├── layout.tsx                # Root layout with QueryClientProvider + AuthProvider
│   │   ├── page.tsx                  # Main page (characters list + stats)
│   │   ├── providers.tsx             # React Query provider (client component)
│   │   ├── login/
│   │   │   └── page.tsx              # Login page
│   │   ├── register/
│   │   │   └── page.tsx              # Register page
│   │   ├── characters/
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Character detail page (optional)
│   │   └── admin/
│   │       └── page.tsx              # Admin panel page (CRUD operations, ADMIN only)
│   ├── components/
│   │   ├── character-card.tsx        # Single character card (clickable)
│   │   ├── character-grid.tsx        # Grid of character cards
│   │   ├── character-detail.tsx      # Detail view / modal content
│   │   ├── stats-bar.tsx             # Stats dashboard summary
│   │   ├── filter-bar.tsx            # Search + status/gender dropdowns + sort
│   │   ├── sort-controls.tsx         # Sort field + direction controls
│   │   ├── pagination.tsx            # Page navigation
│   │   ├── empty-state.tsx           # No results message
│   │   ├── error-state.tsx           # Error with retry
│   │   ├── loading-skeleton.tsx      # Loading skeleton cards
│   │   ├── navbar.tsx                # Navigation with auth state (login/logout/user info)
│   │   ├── auth/
│   │   │   ├── login-form.tsx        # Login form component
│   │   │   ├── register-form.tsx     # Register form component
│   │   │   └── auth-guard.tsx        # Protected route wrapper (checks role)
│   │   └── admin/
│   │       ├── character-form.tsx    # Create/Edit character form
│   │       ├── character-table.tsx   # Admin table with edit/delete actions
│   │       └── delete-dialog.tsx     # Confirm delete dialog
│   ├── generated/
│   │   └── graphql.ts                # Auto-generated by codegen
│   ├── graphql/
│   │   ├── characters.graphql        # List query
│   │   ├── character.graphql         # Detail query
│   │   ├── character-stats.graphql   # Stats query
│   │   ├── register.graphql          # Register mutation
│   │   ├── login.graphql             # Login mutation
│   │   ├── me.graphql                # Current user query
│   │   ├── create-character.graphql  # Create mutation
│   │   ├── update-character.graphql  # Update mutation
│   │   └── delete-character.graphql  # Delete mutation
│   ├── hooks/
│   │   ├── use-auth.ts              # Auth hook (login, register, logout, user state)
│   │   ├── use-characters.ts         # Custom hook: list + nuqs
│   │   ├── use-character.ts          # Custom hook: single character by id
│   │   ├── use-character-stats.ts    # Custom hook: stats
│   │   ├── use-create-character.ts   # Custom hook: create mutation
│   │   ├── use-update-character.ts   # Custom hook: update mutation
│   │   └── use-delete-character.ts   # Custom hook: delete mutation
│   └── lib/
│       ├── graphql-fetcher.ts        # Fetch function with auto JWT header
│       └── auth-store.ts             # Token/user localStorage management
├── codegen.ts
├── .env.local
├── package.json
└── tsconfig.json
```

---

## Environment Variables

```env
# .env.local
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql
```

> **Note:** Admin operations no longer use a separate API key. Instead, they
> use JWT tokens with ADMIN role. The frontend simply includes the JWT token
> from `localStorage` in the `Authorization` header.

---

## Data Flow Summary

### Public Data Flow (queries)
```
URL params (nuqs) → React Query variables → GraphQL POST → Backend filters/sorts/paginates → Response → UI
     ↑                                                                                                    |
     └──────────────── User interacts with search/filters/sort/pagination ────────────────────────────────┘
```

### Auth Data Flow
```
Login/Register Form → GraphQL POST → Backend validates → { accessToken, user } → Store in localStorage → Redirect
```

### Admin Data Flow
```
Admin Form → useMutation → GraphQL POST (with Bearer token) → Backend checks JWT + ADMIN role → Persists → Invalidate queries → UI refreshes
```

1. User types in search or selects a filter/sort → nuqs updates URL query params.
2. Component reads params via nuqs hooks → builds GraphQL variables.
3. React Query fetches with those variables (auto-refetch on variable change).
4. Backend applies filters, search, sorting, and pagination server-side.
5. Response renders cards in grid with pagination controls.

---

## Admin Panel (`/admin`)

An admin page at `/admin` enables character CRUD operations. All admin mutations
require a **JWT token with ADMIN role** — the fetcher automatically includes the
`Authorization: Bearer <token>` header.

### Access Control

- Wrap `/admin` with an auth guard that checks:
  1. User is authenticated (has valid JWT)
  2. User has ADMIN role
- Redirect to `/login` if not authenticated
- Show "Access denied" if authenticated but not ADMIN

### Admin UI Features

| Feature | Description |
|---|---|
| **Character Table** | List all characters in a table/list with edit & delete buttons |
| **Create Button** | Opens a form to create a new character |
| **Edit Button** | Pre-fills form with existing data, calls `updateCharacter` on save |
| **Delete Button** | Shows confirm dialog, calls `deleteCharacter` on confirm |
| **Optimistic Updates** | Use React Query's `useMutation` with `onSuccess` to invalidate `characters` and `characterStats` queries |
| **Form Validation** | Client-side validation matching backend rules (name: 2-100 chars, description: 10-500 chars, image: valid URL) |
| **Success/Error Toasts** | Show toast notifications for mutation results |

### Admin Mutation Hooks (React Query `useMutation`)

```typescript
// Example: use-create-character.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetcher } from '../lib/graphql-fetcher';
import { CREATE_CHARACTER_MUTATION } from '../graphql/create-character';

export function useCreateCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCharacterInput) =>
      fetcher(CREATE_CHARACTER_MUTATION, { input })(),
    onSuccess: () => {
      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['Characters'] });
      queryClient.invalidateQueries({ queryKey: ['CharacterStats'] });
    },
  });
}
```

> **Note:** Admin mutations use the same `fetcher` as queries — the JWT token
> in the `Authorization` header is included automatically. No separate admin
> fetcher is needed.

---

## Key Rules

1. **No client-side filtering.** All filtering/searching/sorting is done by the backend.
2. **URL is the source of truth** for filter and sort state (nuqs).
3. **Omit empty filters** — don't send `{ status: null }`, just omit the key.
4. **Reset page to 1** when any filter or sort changes.
5. **Debounce search** input to avoid excessive API calls.
6. **Handle all states:** loading, error, empty, data, unauthorized, forbidden.
7. **Use `character(id)` query** for detail views — handle 404/not-found errors.
8. **Use `characterStats` query** to show aggregate data (dashboard).
9. **JWT token in `Authorization: Bearer <token>` header** — auto-included by the fetcher from localStorage.
10. **Invalidate queries after mutations** — refetch `characters` and `characterStats` after create/update/delete.
11. **Role-based access control** — check `user.role` to show/hide admin features.
12. **Handle token expiration** — clear localStorage and redirect to login on 401 errors.
