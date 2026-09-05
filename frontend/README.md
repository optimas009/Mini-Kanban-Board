# Mini Kanban — Frontend

Web client for the Mini Kanban Board app. Built with Next.js, React, and Tailwind CSS. Provides authentication screens and an interactive drag-and-drop board view.

## Tech Stack

- **Framework:** Next.js (App Router, TypeScript)
- **Styling:** Tailwind CSS
- **Data fetching / caching:** TanStack Query (React Query)
- **Drag-and-drop:** dnd-kit

## Prerequisites

- Node.js 20+
- The backend API running (see `../backend/README.md`)

## Environment Variables

Copy `.env.example` to `.env.local` and set the API URL:

```bash
cp .env.example .env.local
```

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the backend API | `http://localhost:3001` |

## Local Setup (without Docker)

1. **Install dependencies**
```bash
   npm install
```

2. **Set up environment variables**
```bash
   cp .env.example .env.local
   # edit .env.local if your backend isn't running on localhost:3001
```

3. **Make sure the backend is running** (see `../backend/README.md`, or run `docker compose up -d backend postgres` from the repo root).

4. **Start the dev server**
```bash
   npm run dev
```

   The app will be available at `http://localhost:3000`.

## Running with Docker

From the **repo root** (not this folder):

```bash
docker compose up --build
```

This builds and starts the frontend on `http://localhost:3000`, wired to the backend and database automatically.

## Available Scripts

```bash
npm run dev     # start the dev server with hot reload
npm run build   # production build
npm run start   # run the production build
npm run lint    # lint the codebase
```

## Features

- Email/password registration and login (JWT stored client-side)
- Create, rename, and delete boards
- Share a board with other registered users by email; remove members
- Create, rename, recolor, reorder, and delete columns
- Create, edit, and delete tasks
- Drag-and-drop tasks within a column or across columns, with optimistic UI updates and automatic rollback if the server rejects a move

## Project Structure

```
src/
├── app/
│   ├── boards/            # Boards list + board detail page
│   ├── login/             # Login page
│   └── register/          # Registration page
├── components/
│   ├── BoardView.tsx      # Drag-and-drop board, mutations, optimistic updates
│   ├── BoardColumn.tsx    # Single column with its tasks
│   ├── TaskCard.tsx       # Task card + drag overlay
│   └── ...
├── context/
│   └── AuthContext.tsx    # Auth state (token/user), persisted to localStorage
└── lib/
    ├── api.ts             # Fetch wrapper (attaches auth header, parses errors)
    └── types.ts           # Shared TypeScript types
```
