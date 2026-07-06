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

- `src/app/(auth)/` — Login/register pages (no sidebar). Both wrap `useSearchParams()` in `<Suspense>` boundaries (required by Next.js 16 static prerendering).
- `src/app/(dashboard)/` — All authenticated pages. Layout is a server component that fetches session/notifications, then renders `DashboardShell` (client component managing responsive sidebar state).
- `src/app/api/` — REST routes only (6 dirs): `auth/` (NextAuth), `attachments/` (file download), `invite/` (token validation), `events/` (SSE stream), `cron/` (due-date reminders), `export/` (CSV).
- `src/components/ui/` — Reusable primitives (Button, Card, Input, Badge) — all custom, no component library.
- `src/components/features/` — Domain-specific client components (KanbanBoard, GanttChart, TaskDetail, Sidebar, DashboardShell, etc.).
- `src/services/` — Server actions ("use server") for all mutations and data fetching. 20 action modules.
- `src/lib/auth.ts` — NextAuth config with Credentials provider and JWT callbacks.
- `src/lib/authorization.ts` — `requireAuth()`, `requireProjectMember()`, `getTaskProjectId()`, `getSprintProjectId()`.
- `src/lib/email.ts` — Resend integration for email notifications. Gracefully no-ops without `RESEND_API_KEY`.
- `src/lib/ai.ts` — Anthropic SDK client (Haiku 4.5). Exports `generateText`, `generateJSON<T>`, `isAIEnabled`, `aiErrorMessage`. Gracefully no-ops without `ANTHROPIC_API_KEY` (same pattern as email). Returns typed `AIResult<T> = { ok: true; value: T } | { ok: false; error: AIError }`.
- `src/lib/project-templates.ts` — Built-in project templates (Scrum, Bug Tracking, Product Launch, Website Redesign) with predefined tasks and labels.
- `src/lib/validations.ts` — Zod schemas for all form inputs.
- `src/types/index.ts` — NextAuth module augmentation + `ActionResult<T>` type.

**Path alias:** `@/*` maps to `./src/*`

## Key Patterns

**Server Actions, not REST.** All mutations go through server actions in `src/services/`. REST API routes are only for file downloads, CSV export, SSE, and cron. Forms use React 19 `useActionState`.

**ActionResult<T>** — Every mutation returns `{ success: true, data: T } | { success: false, error: string }`.

**Authorization.** Every server action calls `requireAuth()` and then `requireProjectMember(projectId, userId, role)` from `src/lib/authorization.ts`. ADMIN role bypasses project membership checks. Never add a new server action without these guards.

**NEXT_REDIRECT is an error.** `redirect()` throws a `NEXT_REDIRECT` error. Server actions that call `redirect()` must re-throw it — never swallow it in a try/catch. This has caused bugs before.

**JWT role refresh with 30s cache.** The JWT callback in `src/lib/auth.ts` looks up the user's role via `getCachedRole()` — an in-process `globalThis` map with a 30s TTL. This still picks up role changes without hitting the DB on every request. Any code path that mutates `user.role` (currently `updateUserRole` and `bootstrapAdmin` in `admin-actions.ts`) MUST call `invalidateRoleCache(userId)` right after the write so the change is visible immediately.

**Optimistic UI on Kanban.** `KanbanBoard` applies drag-and-drop status changes and bulk operations optimistically, then calls the server action. On failure it reverts.

**Roles:** ADMIN, PROJECT_MANAGER, DEVELOPER, TESTER. Only ADMIN/PM can create projects and manage sprints. Only ADMIN can access the admin panel and invite system.

**Invite-only registration.** Public signup is disabled. First user auto-promotes to ADMIN. Subsequent users need an invite token (32-byte hex, 7-day expiry).

## Testing

Vitest with mocked Prisma, auth, and Next.js APIs. Config in `vitest.config.mts`.

- Tests live in `src/__tests__/*.test.ts`
- Setup file (`src/__tests__/setup.ts`) mocks `next/cache` and `next/navigation` (redirect throws `NEXT_REDIRECT` like real Next.js)
- Each test file mocks `@/lib/prisma` and `@/lib/auth` with `vi.mock()`
- Run a single test file: `npx vitest run src/__tests__/auth-actions.test.ts`

## Database

15 Prisma models in `prisma/schema.prisma`. PostgreSQL hosted on Neon (free tier).

Use `prisma db push` instead of `prisma migrate dev` — Neon has advisory lock issues with migrations.

After a DB reset: clear browser cookies for localhost:3000 (stale JWT tokens reference deleted user IDs).

Attachments are stored as binary (`Bytes`) in the database — this is a known scalability issue.

Seed data creates 4 users (admin@pms.dev, pm@pms.dev, dev@pms.dev, tester@pms.dev — all password `password123`) plus a sample project.

## Dark Mode

CSS variables in `globals.css` with a `.dark` class. Flash-prevention inline script in `src/app/layout.tsx`. Theme state managed by `ThemeProvider` context in `src/components/features/theme-provider.tsx`. All UI components must support both light and dark variants via `dark:` Tailwind classes.

Global dark mode overrides in `globals.css` auto-adapt common utility classes (`.dark .text-zinc-900`, `.dark .bg-zinc-50`, etc.) so not every component needs explicit `dark:` variants for basic text/background colors.

## Real-Time Updates (SSE)

Server-Sent Events for live updates across browser sessions. Zero external dependencies.

- `src/lib/event-bus.ts` — In-memory pub/sub singleton (same `globalThis` pattern as `prisma.ts`). Channels: `project:{id}`, `user:{userId}`, `task:{id}`, `sprint:{id}`.
- `src/lib/sse-events.ts` — Typed event definitions (`SSEFrame` = `SSEEvent` + `_actorId`). Includes single-task and bulk events.
- `src/app/api/events/route.ts` — Authenticated SSE endpoint. Auto-subscribes to `user:{userId}` for notifications. 30s heartbeat.
- `src/hooks/use-event-stream.ts` — Client hook. Exponential backoff reconnection. Filters out own events via `_actorId` to avoid conflicts with optimistic UI.

**Adding a new real-time event**: Define the type in `sse-events.ts`, emit it in the server action via `eventBus.emit()`, handle it in the component via `useEventStream({ handlers })`.

**Key invariant**: Server actions still call `revalidatePath()` for the acting user. SSE provides updates to *other* users. The `_actorId` field prevents double-application.

## Email Notifications

`src/lib/email.ts` uses Resend for transactional emails. If `RESEND_API_KEY` is not set, all email calls silently no-op — email is best-effort, never blocks the server action. Emails are sent for: task assignment, status changes, comments, project member additions, due-soon, and overdue reminders.

## Project Templates

`src/lib/project-templates.ts` defines built-in templates (Scrum Project, Bug Tracking, Product Launch, Website Redesign). Each template includes predefined labels and tasks. The `createProjectFromTemplate` server action in `project-actions.ts` creates the project, labels, and tasks in one transaction. No schema changes needed — templates are code-only.

## Bulk Task Operations

`bulkUpdateTasks` and `bulkDeleteTasks` in `task-actions.ts` operate on up to 50 tasks at once (status, priority, assignee changes or deletion). The KanbanBoard renders selection checkboxes on each task card and shows a bulk action toolbar when tasks are selected.

## Responsive Layout

The dashboard layout uses `DashboardShell` (client component in `src/components/features/dashboard-shell.tsx`) which manages mobile sidebar state. On desktop (`md:` breakpoint and up), the sidebar renders normally. On mobile, it's hidden and accessible via a hamburger menu that opens a fixed overlay with backdrop. The sidebar's `onNavigate` callback auto-closes it after tapping a nav link.

## Due-Date Reminders

`src/services/due-date-reminder-actions.ts` checks for overdue and due-soon tasks, sends in-app notifications and emails with 24h deduplication. Triggered two ways: fire-and-forget from the dashboard page load, and via `GET /api/cron/due-reminders` (protected by optional `CRON_SECRET` env var).

## Style

No third-party UI component library. Everything is custom Tailwind with a zinc color palette. Icons from `lucide-react`. Geist font family via Next.js.

## Environment Variables

Required: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`

Optional: `DIRECT_URL` (Neon direct connection), `RESEND_API_KEY` and `EMAIL_FROM` (email notifications), `CRON_SECRET` (due-date cron endpoint auth).
