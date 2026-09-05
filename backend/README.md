# Mini Kanban — Backend

REST API for the Mini Kanban Board app. Built with NestJS, Prisma, and PostgreSQL. Handles authentication, board ownership/sharing, and concurrency-safe task/column ordering.

## Tech Stack

- **Framework:** NestJS (TypeScript)
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Auth:** JWT (Passport)
- **Validation:** class-validator / class-transformer

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ (or use the root `docker-compose.yml` to run it in a container)

## Environment Variables

Copy `.env.example` to `.env` and fill in real values:

```bash
cp .env.example .env
```

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://kanban_user:kanban_password@localhost:5432/mini_kanban?schema=public` |
| `JWT_SECRET` | Secret used to sign access tokens — use a long random value in production | `change-me` |
| `PORT` | Port the API listens on (optional, defaults to `3001`) | `3001` |
| `FRONTEND_URL` | Origin allowed by CORS (optional, defaults to `http://localhost:3000`) | `http://localhost:3000` |

## Local Setup (without Docker)

1. **Install dependencies**
```bash
   npm install
```

2. **Start PostgreSQL** — either run it locally, or just spin up the database service from the root Docker Compose file:
```bash
   docker compose up -d postgres
```

3. **Set up environment variables**
```bash
   cp .env.example .env
   # edit .env with your DATABASE_URL and JWT_SECRET
```

4. **Run database migrations**
```bash
   npx prisma migrate deploy --config prisma7.config.ts
```

5. **Generate the Prisma client**
```bash
   npx prisma generate --config prisma7.config.ts
```

6. **Start the server**
```bash
   npm run start:dev
```

   The API will be available at `http://localhost:3001`.

## Running with Docker

From the **repo root** (not this folder):

```bash
docker compose up --build
```

This starts PostgreSQL, runs migrations automatically, and boots the backend on `http://localhost:3001`.



A full manual test flow (including expected 401/403/404 cases) is available in the Postman collection at the repo root: `Mini Kanban API - Manual Test Flow.postman_collection.json`.

## Project Structure

```
src/
├── auth/          # Registration, login, JWT strategy/guard
├── boards/        # Board CRUD, sharing, access-control checks
├── columns/       # Column CRUD + reordering
├── tasks/         # Task CRUD + move-within/across-column logic
├── prisma/        # Prisma service wrapper
└── generated/     # Prisma client (auto-generated, do not edit)
prisma/
├── schema.prisma
└── migrations/
```
