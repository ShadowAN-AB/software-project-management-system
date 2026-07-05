# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start dev server (Turbopack, port 3000)
npm run build            # Production build
npm run lint             # ESLint
npm run test             # Run tests (vitest run)
npm run test:watch       # Watch mode (vitest)

# Database (Prisma + PostgreSQL via Neon)
npm run db:push          # Sync schema.prisma → DB (preferred over migrate for Neon)
npm run db:generate      # Regenerate Prisma client after schema changes
npm run db:seed          # Seed demo data (admin@pms.dev / password123)
npm run db:studio        # Visual DB browser
```

After any schema change: run `db:push` then `db:generate` (both required).

## Architecture

Next.js 16 App Router with React 19, TypeScript (strict), Tailwind CSS v4, Prisma 6, NextAuth v5 (JWT).

**Layering:** Pages → Feature Components → Server Actions → Prisma → PostgreSQL

- `src/app/(auth)/` — Login/register pages (no sidebar)
- `src/app/(dashboard)/` — All authenticated pages (shared layout with sidebar + notification bell)
- `src/app/api/` — 6 API routes: NextAuth handler, attachment download, invite validation, SSE event stream, cron due-date reminders, CSV export
- `src/components/ui/` — Reusable primitives (Button, Card, Input, Badge) — all custom, no component library
- `src/components/features/` — Domain-specific client components (KanbanBoard, TaskDetail, TaskChecklist, Sidebar, etc.)
- `src/services/` — Server actions ("use server") for all mutations and data fetching. 20 action modules.
- `src/lib/auth.ts` — NextAuth config with Credentials provider and JWT callbacks
- `src/lib/authorization.ts` — Shared auth helpers: `requireAuth()`, `requireProjectMember()`, `getTaskProjectId()`, `getSprintProjectId()`
- `src/lib/validations.ts` — Zod schemas for all form inputs
- `src/types/index.ts` — NextAuth module augmentation + `ActionResult<T>` type

**Path alias:** `@/*` maps to `./src/*`

## Key Patterns

**Server Actions, not REST.** All mutations go through server actions in `src/services/`. REST API routes are only for file downloads, CSV export, SSE, and cron. Forms use React 19 `useActionState`.

**ActionResult<T>** — Every mutation returns `{ success: true, data: T } | { success: false, error: string }`.

**Authorization.** Every server action calls `requireAuth()` and then `requireProjectMember(projectId, userId, role)` from `src/lib/authorization.ts`. ADMIN role bypasses project membership checks. Never add a new server action without these guards.

**NEXT_REDIRECT is an error.** `redirect()` throws a `NEXT_REDIRECT` error. Server actions that call `redirect()` must re-throw it — never swallow it in a try/catch. This has caused bugs before.

**JWT role refresh from DB.** The JWT callback in `src/lib/auth.ts` queries the database on every request to pick up role changes immediately. This is intentional — don't remove it.

**Optimistic UI on Kanban.** `KanbanBoard` applies drag-and-drop status changes optimistically, then calls the server action. On failure it reverts.

**Roles:** ADMIN, PROJECT_MANAGER, DEVELOPER, TESTER. Only ADMIN/PM can create projects and manage sprints. Only ADMIN can access the admin panel and invite system.

**Invite-only registration.** Public signup is disabled. First user auto-promotes to ADMIN. Subsequent users need an invite token (32-byte hex, 7-day expiry).

## Testing

Vitest with mocked Prisma, auth, and Next.js APIs. Config in `vitest.config.mts`.

- Tests live in `src/__tests__/*.test.ts`
- Setup file (`src/__tests__/setup.ts`) mocks `next/cache` and `next/navigation` (redirect throws `NEXT_REDIRECT` like real Next.js)
- Each test file mocks `@/lib/prisma` and `@/lib/auth` with `vi.mock()`
- Run a single test file: `npx vitest run src/__tests__/auth-actions.test.ts`

## Database

14 Prisma models in `prisma/schema.prisma`. PostgreSQL hosted on Neon (free tier).

Use `prisma db push` instead of `prisma migrate dev` — Neon has advisory lock issues with migrations.

After a DB reset: clear browser cookies for localhost:3000 (stale JWT tokens reference deleted user IDs).

Attachments are stored as binary (`Bytes`) in the database — this is a known scalability issue.

## Dark Mode

CSS variables in `globals.css` with a `.dark` class. Flash-prevention inline script in `src/app/layout.tsx`. Theme state managed by `ThemeProvider` context in `src/components/features/theme-provider.tsx`. All UI components must support both light and dark variants via `dark:` Tailwind classes.

## Real-Time Updates (SSE)

The app uses Server-Sent Events for live updates across browser sessions. Zero external dependencies.

- `src/lib/event-bus.ts` — In-memory pub/sub singleton (same `globalThis` pattern as `prisma.ts`). Channels: `project:{id}`, `user:{userId}`, `task:{id}`, `sprint:{id}`.
- `src/lib/sse-events.ts` — Typed event definitions (`SSEFrame` = `SSEEvent` + `_actorId`).
- `src/app/api/events/route.ts` — Authenticated SSE endpoint. Auto-subscribes to `user:{userId}` for notifications. 30s heartbeat.
- `src/hooks/use-event-stream.ts` — Client hook. Exponential backoff reconnection. Filters out own events via `_actorId` to avoid conflicts with optimistic UI.

**Adding a new real-time event**: Define the type in `sse-events.ts`, emit it in the server action via `eventBus.emit()`, handle it in the component via `useEventStream({ handlers })`.

**Key invariant**: Server actions still call `revalidatePath()` for the acting user. SSE provides updates to *other* users. The `_actorId` field prevents double-application.

## Due-Date Reminders

`src/services/due-date-reminder-actions.ts` checks for overdue and due-soon tasks, sends notifications with 24h deduplication. Triggered two ways: fire-and-forget from the dashboard page load, and via `GET /api/cron/due-reminders` (protected by optional `CRON_SECRET` env var).

## Style

No third-party UI component library. Everything is custom Tailwind with a zinc color palette. Icons from `lucide-react`. Geist font family via Next.js.
