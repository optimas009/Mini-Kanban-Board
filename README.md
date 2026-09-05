# Mini Kanban Board

A collaborative Kanban board where users register, create boards, organise work into
colour-coded columns, and drag tasks between them. Boards can be shared with other
registered users, and every read and write is checked against board membership.

| Layer | Stack |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, TanStack Query, dnd-kit |
| Backend | NestJS 12, TypeScript, Passport JWT, class-validator |
| Database | PostgreSQL 17 with Prisma 7 |
| DevOps | Docker Compose |

---

## Table of contents

- [Quick start with Docker](#quick-start-with-docker)
- [Manual setup](#manual-setup)
- [Environment variables](#environment-variables)
- [API reference](#api-reference)
- [Data model](#data-model)
- [How the design works](#how-the-design-works)
- [Project layout](#project-layout)
- [Troubleshooting](#troubleshooting)

---

## Quick start with Docker

Requires Docker Desktop (or Docker Engine with the Compose plugin). This builds and
starts all three services and applies database migrations automatically.

```bash
git clone <your-repository-url>
cd mini-kanban
docker compose up -d --build
```

Then open **http://localhost:3000** and register an account.

| Service | URL |
| --- | --- |
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| PostgreSQL | `localhost:5432` (user `kanban_user`, password `kanban_password`, database `mini_kanban`) |

Useful commands:

```bash
docker compose logs -f backend     # follow backend logs
docker compose ps                  # service status
docker compose down                # stop everything (database volume is kept)
docker compose down -v             # stop everything and delete the database volume
```

The backend container runs `prisma migrate deploy` on start, so the schema is created
on first boot without any extra step.

Both images are multi-stage and run as a non-root `nodejs` user. The backend ships
only production dependencies (`npm ci --omit=dev`); the frontend ships Next's
`standalone` output, which is the server plus just the modules it actually imports.
Both declare a `HEALTHCHECK`, and Compose gates startup on them, so `frontend` waits
for the API to answer rather than merely to start, and the first page load cannot
race an unmigrated database. `docker compose up -d --wait` returns only once all
three report healthy.

The Prisma CLI is a runtime dependency rather than a dev one, because the container
runs migrations on start. That costs roughly 150MB in the backend image (the CLI
pulls in TypeScript to read `prisma7.config.ts`). It buys the one-command setup
above. If image size mattered more than that, the migration step would move to a
short-lived job container and the runtime image would drop the CLI entirely.

> **Set a real `JWT_SECRET` before deploying anywhere.** Compose falls back to
> `change-me-in-production`; override it with `JWT_SECRET=... docker compose up -d`
> or a root `.env` file.

---

## Manual setup

Use this for day-to-day development with hot reload. Requires **Node.js 22+** and
**npm 10+**. Docker is still the easiest way to get PostgreSQL, but any local
PostgreSQL 14+ instance works.

### 1. Start PostgreSQL only

```bash
docker compose up -d postgres
```

If you prefer your own PostgreSQL server, create a database and update `DATABASE_URL`
in step 2 accordingly.

### 2. Backend

```bash
cd backend
cp .env.example .env          # then edit JWT_SECRET
npm install
npm run prisma:generate       # generate the Prisma client into src/generated/prisma
npm run prisma:deploy         # apply migrations
npm run start:dev             # http://localhost:3001
```

`npm run prisma:generate` must run before the first build: `src/prisma/prisma.service.ts`
imports the generated client from `src/generated/prisma`, which is gitignored.

### 3. Frontend

In a second terminal:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev                   # http://localhost:3000
```

Open http://localhost:3000, register a user, and create your first board.

### Available scripts

**Backend** (`cd backend`)

| Script | Description |
| --- | --- |
| `npm run start:dev` | Development server with watch mode |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start:prod` | Run the compiled server |
| `npm run lint` | Lint with oxlint |
| `npm run format` | Format with Prettier |
| `npm run prisma:generate` | Regenerate the Prisma client |
| `npm run prisma:migrate` | Create and apply a new migration (development) |
| `npm run prisma:deploy` | Apply existing migrations (CI/production) |

**Frontend** (`cd frontend`)

| Script | Description |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Lint with ESLint |

---

## Environment variables

### `backend/.env` — copy from [`backend/.env.example`](backend/.env.example)

| Variable | Required | Example | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | `postgresql://kanban_user:kanban_password@localhost:5432/mini_kanban?schema=public` | PostgreSQL connection string |
| `JWT_SECRET` | yes | `a-long-random-string` | Signing secret for access tokens. The server refuses to start without it |
| `PORT` | no | `3001` | Port the API listens on (default `3001`) |
| `FRONTEND_URL` | no | `http://localhost:3000` | Origin allowed by CORS (default `http://localhost:3000`) |

### `frontend/.env.local` — copy from [`frontend/.env.example`](frontend/.env.example)

| Variable | Required | Example | Description |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | no | `http://localhost:3001` | Base URL of the API (default `http://localhost:3001`) |

`NEXT_PUBLIC_*` values are inlined into the client bundle at build time, so this must
be a URL the **browser** can reach — not a Docker-internal hostname like
`http://backend:3001`. In Compose it is passed as a build argument.

---

## API reference

All routes except `GET /`, `POST /auth/register`, and `POST /auth/login` require an
`Authorization: Bearer <accessToken>` header. Tokens are valid for 24 hours.

A ready-made Postman collection covering the full flow is included:
[`Mini Kanban API - Manual Test Flow.postman_collection.json`](Mini%20Kanban%20API%20-%20Manual%20Test%20Flow.postman_collection.json).

### Health

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | Returns `{ message, status }` |

### Authentication

| Method | Endpoint | Body | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | `{ name, email, password }` | Create an account. Returns `{ user, accessToken }` |
| `POST` | `/auth/login` | `{ email, password }` | Sign in. Returns `{ user, accessToken }` |

Passwords must be 8–72 characters and are hashed with bcrypt (12 rounds).

### Boards

| Method | Endpoint | Body | Access |
| --- | --- | --- | --- |
| `POST` | `/boards` | `{ name }` | Any authenticated user |
| `GET` | `/boards` | — | Returns boards you own **or** are a member of |
| `GET` | `/boards/:boardId` | — | Owner or member. Includes columns, tasks and members |
| `PATCH` | `/boards/:boardId` | `{ name }` | **Owner only** |
| `DELETE` | `/boards/:boardId` | — | **Owner only**. Cascades to columns and tasks |
| `POST` | `/boards/:boardId/members` | `{ email }` | **Owner only**. Shares with a registered user |
| `DELETE` | `/boards/:boardId/members/:memberUserId` | — | **Owner only**. Revokes access |

### Columns

| Method | Endpoint | Body | Access |
| --- | --- | --- | --- |
| `POST` | `/boards/:boardId/columns` | `{ title, color? }` | Owner or member |
| `PATCH` | `/columns/:columnId` | `{ title?, color? }` | Owner or member |
| `PATCH` | `/columns/:columnId/move` | `{ position }` | Owner or member |
| `DELETE` | `/columns/:columnId` | — | Owner or member. Cascades to tasks |

`color` is one of `navy`, `blue`, `red`, `yellow`, `purple`, `cyan`, `green`, `slate`
(default `navy`).

### Tasks

| Method | Endpoint | Body | Access |
| --- | --- | --- | --- |
| `POST` | `/columns/:columnId/tasks` | `{ title, description? }` | Owner or member |
| `PATCH` | `/tasks/:taskId` | `{ title?, description? }` | Owner or member |
| `PATCH` | `/tasks/:taskId/move` | `{ columnId, position }` | Owner or member |
| `DELETE` | `/tasks/:taskId` | — | Owner or member |

**`PATCH /tasks/:taskId/move` is the task movement endpoint.** It handles both cases
with one call:

- **Reorder within a column** — pass the task's current `columnId` and the new
  `position`.
- **Move across columns** — pass the destination `columnId` and the target `position`
  index within it.

`position` is a zero-based index. Values past the end of the list are clamped to the
last valid slot, so a client never has to know the exact column length. Moving a task
into a column on a different board is rejected with `400`.

### Error responses

| Status | Meaning |
| --- | --- |
| `400` | Validation failure, or an illegal move (for example across boards) |
| `401` | Missing, malformed, or expired token |
| `403` | Authenticated, but the action is owner-only |
| `404` | Resource missing, **or** you have no access to it |
| `409` | Conflict: email already registered, user already a board member, or a write conflict that exhausted its retries |

Boards you have no access to return `404` rather than `403`, so the API does not
disclose whether a board id exists.

---

## Data model

```
User ──owns──────────> Board ──> Column ──> Task
  └──BoardMember────────┘
```

| Model | Notes |
| --- | --- |
| `User` | `id`, `name`, unique `email`, `passwordHash` |
| `Board` | `id`, `name`, `ownerId` |
| `BoardMember` | Join table with composite primary key `(boardId, userId)`, which makes duplicate shares impossible at the database level |
| `Column` | `id`, `title`, `color`, `position`, `boardId` |
| `Task` | `id`, `title`, optional `description`, `position`, `columnId` |

Deletes cascade down the tree, so removing a board removes its columns and tasks, and
removing a user removes the boards they own. The schema lives in
[`backend/prisma/schema.prisma`](backend/prisma/schema.prisma).

---

## How the design works

### Access control

Authorisation is enforced in the service layer, not in the UI. Two helpers in
[`backend/src/boards/boards.service.ts`](backend/src/boards/boards.service.ts) gate
every operation:

- `assertCanAccess(userId, boardId)` — passes for the owner **or** any board member.
  Used by all column and task operations.
- `assertOwner(userId, boardId)` — owner only. Used for renaming, deleting, and
  sharing a board.

Column and task routes are addressed by their own id (`/tasks/:taskId`), so each
service first resolves the record's parent board and then runs the access check
against it. There is no route on which a user can reach a board they are not a member
of, and no client-supplied board id is ever trusted.

### Ordering and conflict-free reordering

Columns and tasks use a contiguous zero-based integer `position` within their parent.

Every mutation that touches ordering — create, move, delete — runs inside a
PostgreSQL **`Serializable`** transaction that shifts the affected sibling range with
a single `updateMany`, then writes the moved row. Serialisation failures (Prisma error
`P2034`) are retried up to three times.

This is what keeps ordering stable under concurrent edits, which matters because
boards are shared. Two people dragging cards in the same column at the same moment
cannot interleave their reads and writes into a state with duplicate or missing
positions: one transaction serialises after the other and is retried against the
committed result. Positions stay contiguous with no gaps and no duplicates.

Deleting a task or column closes the gap it leaves behind in the same transaction, so
positions never drift apart over time.

One detail worth knowing about, because it is easy to get wrong: through a Prisma
driver adapter (`@prisma/adapter-pg`, used here) a write conflict arrives as a
`DriverAdapterError` carrying no error code, not as the documented `P2034`. Checking
only for `P2034` makes the retry loop silently dead, and every conflict then escapes
as a 500. `withSerializableRetry` matches all the shapes a conflict can take, and
returns `409` if the budget is exhausted, because a losing transaction is retryable
rather than broken.

### Why integer positions rather than fractional indexing

Moving a task rewrites the positions of its siblings, which is `O(n)` writes per move
against fractional indexing's `O(1)`. That is a deliberate trade, not an oversight.

Integer positions stay dense and human-readable, sort correctly forever, and need no
rebalancing pass. Fractional keys drift toward floating point precision limits after
repeated insertions between neighbours, so a production system using them needs
periodic renormalisation, which is a second piece of machinery to write and test.

At kanban scale, tens of cards in a column, `O(n)` is a handful of rows inside one
transaction. Fractional indexing earns its complexity when lists run to thousands of
items with many concurrent editors. If this board ever reached that scale, the
`position` column and the move endpoint are the only things that would change; the
API contract already speaks in target indexes rather than sort keys, so clients would
not need to change at all.

## Tests

```bash
cd backend  && npm test         # 82 unit tests
cd backend  && npm run test:e2e # 64 end-to-end tests, needs postgres running
cd frontend && npm test         # 32 unit tests
```

Unit tests run against mocked Prisma clients and cover access control, sharing,
ordering arithmetic and retry behaviour. The frontend suite covers drag-and-drop
drop-target resolution and optimistic reordering.

The e2e suite drives real HTTP through the Nest application against a dedicated
`mini_kanban_test` database, created and migrated automatically on first run. It
covers authentication, the whole permission matrix, task movement and order
consistency under concurrent writes. Because it truncates tables between tests, it
refuses to run against any database whose name does not end in `_test`.

### Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and pull
request, in three parallel jobs:

- **Backend**: lint, build, unit tests, and the e2e suite against a real PostgreSQL
  service container.
- **Frontend**: typecheck, lint, unit tests, production build.
- **Docker**: builds the compose stack from a clean checkout, brings it up with
  `--wait`, and curls both services. This is what a reviewer does first, so it is
  worth failing the build over.

### Drag and drop

The board view uses **dnd-kit**. Each column renders explicit drop slots in the gaps
between cards, which are wider than the visible indicator, so dropping does not
require pixel-perfect aiming. A custom collision strategy prefers a gap slot, then a
card, and falls back to the column body.

Moves are **optimistic**: the reordered board is written into the TanStack Query cache
immediately, the request is sent, and a pre-drag snapshot is restored if the request
fails. Either way the board is refetched afterwards so the server stays the source of
truth.

---

## Project layout

```
mini-kanban/
├── docker-compose.yml          # postgres + backend + frontend
├── backend/
│   ├── Dockerfile
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── src/
│       ├── auth/               # register, login, JWT strategy, guard
│       ├── boards/             # board CRUD, sharing, access-control helpers
│       ├── columns/            # column CRUD and reordering
│       ├── tasks/              # task CRUD and the move endpoint
│       └── prisma/             # Prisma service
└── frontend/
    ├── Dockerfile
    └── src/
        ├── app/                # App Router: /, /login, /register, /boards, /boards/[boardId]
        ├── components/         # BoardView, BoardColumn, TaskCard, modals
        ├── context/            # AuthContext (token persistence)
        └── lib/                # API client and shared types
```

---

## Troubleshooting

**`Another next build process is already running`, or `Access is denied` on
`.next/cache/turbopack/*.sst`**
A `next dev` server is running and holding the Turbopack cache. Stop it before running
`npm run build`. This only affects production builds; development is unaffected.

**Backend exits with `DATABASE_URL is not defined` or `JWT_SECRET` errors**
`backend/.env` is missing. Copy it from `backend/.env.example`.

**`Cannot find module './generated/prisma/client.js'`**
The Prisma client has not been generated yet. Run `npm run prisma:generate` in
`backend/`.

**Port 3000, 3001, or 5432 already in use**
Another process is bound to it. Stop it, or change the published port in
`docker-compose.yml`.

**Database schema is out of date after pulling changes**
Run `npm run prisma:deploy` in `backend/`, or restart the backend container, which
applies migrations on start.
