# case-be

Character Management GraphQL API built with **NestJS 11**, **Prisma 6**, **Apollo Server 5**, and **PostgreSQL**.

> **Live:** `http://100.30.49.40:4000/graphql`

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Authentication & Authorization](#authentication--authorization)
- [GraphQL API Reference](#graphql-api-reference)
  - [Auth — Public](#auth--public)
  - [Characters — Public Queries](#characters--public-queries)
  - [Characters — Admin Mutations](#characters--admin-mutations)
- [Health Check](#health-check)
- [Docker](#docker)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Scripts](#scripts)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 |
| Framework | NestJS 11 |
| GraphQL | Apollo Server 5, `@nestjs/graphql` (code-first) |
| ORM | Prisma 6 |
| Database | PostgreSQL (RDS) |
| Auth | JWT (`@nestjs/jwt`, `passport-jwt`, `bcryptjs`) |
| Validation | `class-validator`, `class-transformer`, `Joi` (env) |
| Rate Limiting | `@nestjs/throttler` (100 req/min) |
| Health Check | `@nestjs/terminus` |
| Query Protection | `graphql-query-complexity` (max depth/complexity) |
| Container | Docker (multi-stage build) |

---

## Architecture

```
src/
├── main.ts                    # Bootstrap, CORS, validation pipes, shutdown hooks
├── app.module.ts              # Root module — imports all feature modules
├── auth/                      # JWT authentication & role-based authorization
│   ├── guards/                # JwtAuthGuard (global), RolesGuard (global)
│   ├── decorators/            # @Public(), @Roles(), @CurrentUser()
│   ├── strategies/            # Passport JWT strategy
│   ├── dto/                   # RegisterInput, LoginInput
│   ├── models/                # User, AuthResponse GraphQL types
│   ├── auth.service.ts        # Register, login, JWT signing
│   └── auth.resolver.ts       # register, login, me
├── characters/                # Character CRUD
│   ├── dto/                   # Filter, pagination, sort, create, update inputs
│   ├── models/                # Character, CharacterConnection, CharacterStats, enums
│   ├── characters.service.ts  # Business logic, Prisma queries
│   └── characters.resolver.ts # GraphQL resolvers
├── health/                    # Health check endpoint (/health)
├── prisma/                    # PrismaService (connection management)
├── config/                    # Joi env validation schema
├── plugins/                   # Apollo complexity plugin
└── guards/                    # Legacy API key guard (deprecated)
```

---

## Getting Started

### Prerequisites

- **Node.js 22+**
- **npm**
- **Docker** (for local PostgreSQL)

### Installation

```bash
# 1. Clone
git clone https://github.com/Abdulberk/case-be.git
cd case-be

# 2. Install dependencies
npm install

# 3. Set up environment
copy .env.example .env
# Edit .env with your database credentials

# 4. Start local PostgreSQL
docker compose up -d

# 5. Generate Prisma client & run migrations
npm run prisma:generate
npm run prisma:migrate

# 6. Seed the database (optional — creates test users & characters)
npm run prisma:seed

# 7. Start development server
npm run start:dev
```

The server starts at:

```
GraphQL:      http://localhost:4000/graphql
Health check: http://localhost:4000/health
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | — | JWT signing secret (min 16 chars) |
| `JWT_EXPIRES_IN` | — | `7d` | Token expiry (`1h`, `7d`, `30d`) |
| `PORT` | — | `4000` | Server port |
| `NODE_ENV` | — | `development` | `development` / `test` / `production` |
| `FRONTEND_ORIGIN` | — | `http://localhost:3000` | CORS allowed origins (comma-separated) |

Example `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/case_be?schema=public
PORT=4000
FRONTEND_ORIGIN=http://localhost:3000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-at-least-16-chars
JWT_EXPIRES_IN=7d
```

---

## Authentication & Authorization

The API uses **JWT Bearer tokens** with **role-based access control**.

### How it works

1. **Global JWT Guard** — Every request requires a valid JWT token by default
2. **`@Public()` decorator** — Marks endpoints as publicly accessible (no token needed)
3. **`@Roles('ADMIN')` decorator** — Restricts endpoints to users with the ADMIN role
4. **Roles:** `USER` (default), `ADMIN`

### Access levels

| Endpoint | Access | Description |
|---|---|---|
| `register`, `login` | 🌐 Public | No auth needed |
| `characters`, `character`, `characterStats` | 🌐 Public | No auth needed |
| `me` | 🔐 Authenticated | Any valid JWT |
| `createCharacter`, `updateCharacter`, `deleteCharacter` | 👑 Admin | JWT with ADMIN role |
| `GET /health` | 🌐 Public | No auth needed |

### Token usage

Include the JWT token in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Seed users (development)

After running `npm run prisma:seed`:

| Email | Password | Role |
|---|---|---|
| `admin@example.com` | `admin123` | ADMIN |
| `user@example.com` | `user1234` | USER |

---

## GraphQL API Reference

### Auth — Public

#### Register

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

Variables:
```json
{
  "input": {
    "email": "john@example.com",
    "password": "mypassword123",
    "name": "John Doe"
  }
}
```

#### Login

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

Variables:
```json
{
  "input": {
    "email": "admin@example.com",
    "password": "admin123"
  }
}
```

#### Me (authenticated)

```graphql
query Me {
  me {
    id
    email
    name
    role
    createdAt
  }
}
```

> Requires `Authorization: Bearer <token>` header.

---

### Characters — Public Queries

#### Get single character

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

#### List characters (with filter, pagination, sorting)

```graphql
query Characters(
  $filter: CharactersFilterInput
  $pagination: PaginationInput
  $sort: CharacterSortInput
) {
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

Variables:
```json
{
  "filter": {
    "status": "ALIVE",
    "gender": "FEMALE",
    "search": "aurora"
  },
  "pagination": {
    "skip": 0,
    "take": 10
  },
  "sort": {
    "field": "NAME",
    "direction": "ASC"
  }
}
```

**Filter options:**

| Field | Type | Description |
|---|---|---|
| `status` | `CharacterStatus` | `ALIVE`, `DEAD`, `UNKNOWN` |
| `gender` | `CharacterGender` | `MALE`, `FEMALE`, `UNKNOWN` |
| `search` | `String` | Case-insensitive search on `name` and `description` |

**Pagination:**

| Field | Default | Max | Description |
|---|---|---|---|
| `skip` | `0` | — | Offset |
| `take` | `20` | `50` | Page size (capped at 50) |

**Sorting:**

| Field | Values |
|---|---|
| `field` | `NAME` (default), `STATUS`, `GENDER` |
| `direction` | `ASC` (default), `DESC` |

#### Character stats

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

---

### Characters — Admin Mutations

> All mutations require `Authorization: Bearer <token>` with an **ADMIN** role user.

#### Create character

```graphql
mutation CreateCharacter($input: CreateCharacterInput!) {
  createCharacter(input: $input) {
    id
    name
    image
    status
    gender
    description
  }
}
```

Variables:
```json
{
  "input": {
    "name": "New Character",
    "image": "https://example.com/avatar.png",
    "status": "ALIVE",
    "gender": "MALE",
    "description": "A brave warrior from the northern frontier."
  }
}
```

**Validation:**

| Field | Rules |
|---|---|
| `name` | Required, 2–100 chars |
| `image` | Required, valid URL |
| `status` | Optional, defaults to `UNKNOWN` |
| `gender` | Optional, defaults to `UNKNOWN` |
| `description` | Required, 10–500 chars |

#### Update character

```graphql
mutation UpdateCharacter($id: ID!, $input: UpdateCharacterInput!) {
  updateCharacter(id: $id, input: $input) {
    id
    name
    status
    description
  }
}
```

Variables:
```json
{
  "id": "char_aurora_vale",
  "input": {
    "status": "DEAD",
    "description": "Updated description for this character (min 10 chars)."
  }
}
```

> All fields are optional — only send what you want to update.

#### Delete character

```graphql
mutation DeleteCharacter($id: ID!) {
  deleteCharacter(id: $id) {
    id
    success
  }
}
```

---

## Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" }
  },
  "error": {},
  "details": {
    "database": { "status": "up" }
  }
}
```

---

## Docker

### Build & run

```bash
docker build -t case-be .
docker run -d \
  --name case-be \
  --env-file .env \
  -p 4000:4000 \
  --restart unless-stopped \
  case-be
```

### Run migrations (production)

```bash
docker run --rm --env-file .env case-be npx prisma migrate deploy
```

The Dockerfile uses a **multi-stage build**:
1. **Build stage** — installs all deps, generates Prisma client, compiles TypeScript
2. **Production stage** — only production deps + compiled output (~slim image)

Includes a `HEALTHCHECK` directive for container health monitoring.

---

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov
```

Tests include:
- **Character service** — CRUD operations, filtering, pagination, stats
- **Character resolver** — E2E with JWT auth, role-based access
- **Auth service** — Register, login, duplicate email, wrong password

---

## Project Structure

```
case-be/
├── prisma/
│   ├── schema.prisma          # Database schema (User, Character)
│   ├── migrations/            # Migration files
│   ├── seed.ts                # Database seeder
│   └── seed-data.ts           # Seed data (users + characters)
├── src/
│   ├── auth/                  # Authentication module
│   ├── characters/            # Characters module
│   ├── health/                # Health check module
│   ├── prisma/                # Prisma service
│   ├── config/                # Env validation
│   ├── plugins/               # Apollo plugins (complexity)
│   ├── guards/                # Legacy guards
│   ├── app.module.ts          # Root module
│   └── main.ts                # Entry point
├── test/                      # Test files
├── docs/                      # Documentation
│   ├── frontend-implementation-plan.md
│   ├── frontend-auth-migration-guide.md
│   └── ec2-deployment-guide.md
├── Dockerfile                 # Multi-stage Docker build
├── docker-compose.yml         # Local PostgreSQL
└── .env.example               # Environment template
```

---

## Deployment

The API is deployed on **AWS EC2** with Docker.

- **EC2:** `t3.medium`, Amazon Linux 2023
- **Elastic IP:** `100.30.49.40`
- **Database:** AWS RDS PostgreSQL
- **Port:** `4000`

See [docs/ec2-deployment-guide.md](docs/ec2-deployment-guide.md) for full deployment instructions.

### Quick update on EC2

```bash
ssh -i your-key.pem ec2-user@100.30.49.40
cd ~/case-be
git pull origin main
docker build -t case-be .
docker run --rm --env-file .env case-be npx prisma migrate deploy
docker stop case-be && docker rm case-be
docker run -d --name case-be --env-file .env -p 4000:4000 --restart unless-stopped case-be
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run start:prod` | Run compiled app |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
| `npm test` | Run tests |
| `npm run test:cov` | Run tests with coverage |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run migrations (dev) |
| `npm run prisma:seed` | Seed database |
| `npm run prisma:studio` | Open Prisma Studio GUI |

---

## Error Responses

GraphQL errors follow this format:

```json
{
  "errors": [
    {
      "message": "Character with id \"xyz\" not found",
      "extensions": {
        "code": "NOT_FOUND",
        "stacktrace": ["..."]
      }
    }
  ]
}
```

| Status | When |
|---|---|
| `401 Unauthorized` | Missing or invalid JWT token |
| `403 Forbidden` | Valid token but insufficient role |
| `404 Not Found` | Character ID doesn't exist |
| `400 Bad Request` | Validation error (invalid input) |
| `429 Too Many Requests` | Rate limit exceeded (100 req/min) |

---

## License

UNLICENSED — Private project.
