# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start dev server (Turbopack, port 3000)
npm run build            # Production build
npm run lint             # ESLint
npm run test             # Run tests (vitest run)
npm run test:watch       # Watch mode (vitest)

# Database (Prisma + PostgreSQL via Supabase)
npm run db:push          # Sync schema.prisma → DB (preferred over migrate)
npm run db:generate      # Regenerate Prisma client after schema changes
npm run db:seed          # Seed demo data (admin@pms.dev / password123)
npm run db:studio        # Visual DB browser
```

After any schema change: run `db:push` then `db:generate` (both required).

## Architecture

Next.js 16 App Router with React 19, TypeScript (strict), Tailwind CSS v4, Prisma 6, NextAuth v5 (JWT).

**Layering:** Pages → Feature Components → Server Actions → Prisma → PostgreSQL

- `src/app/(auth)/` — Login/register pages (no sidebar). Both wrap `useSearchParams()` in `<Suspense>` boundaries (required by Next.js 16 static prerendering).
- `src/app/(dashboard)/layout.tsx` — bare auth gate. Sub-routes render their own chrome.
- `src/app/(dashboard)/w/[workspaceSlug]/layout.tsx` — resolves `WorkspaceContext` via `requireWorkspaceMember(slug, userId)` (React.cache'd), fetches notifications + workspaces, renders `DashboardShell`. All authenticated app pages live under this.
- `src/app/(dashboard)/onboarding/create-workspace/` — form for creating additional workspaces (also the fallback when a user has zero memberships).
- `src/app/(dashboard)/invitations/` — stub for M4 cross-workspace invite acceptance.
- `src/app/api/` — REST routes only: `auth/` (NextAuth), `attachments/` (download), `invite/validate/`, `events/` (SSE), `cron/due-reminders/`, `export/` (CSV) + `export/reports/` (PDF).
- `src/proxy.ts` — Next 16 middleware equivalent. Matches `/w/:path*`, syncs `lastWorkspaceSlug` cookie with URL so client-invoked server actions resolve to the current workspace.
- `src/components/ui/` — Reusable primitives (Button, Card, Input, Badge, Avatar, Markdown) — all custom, no component library.
- `src/components/features/` — Domain-specific client components (KanbanBoard, GanttChart, TaskDetail, Sidebar, DashboardShell, etc.).
- `src/services/` — Server actions ("use server") for all mutations and data fetching. 20 action modules.
- `src/lib/auth.ts` — NextAuth config with Credentials provider and JWT callbacks.
- `src/lib/authorization.ts` — `requireAuth()`, `requireWorkspaceMember(slug, userId)` (React.cache'd), `requireProjectMember(projectId, userId, ctx)`, `resolveDefaultWorkspace(userId)` (URL/cookie-aware shim), `getTaskProjectId()`, `getSprintProjectId()`.
- `src/lib/email.ts` — Resend integration for email notifications. Gracefully no-ops without `RESEND_API_KEY`.
- `src/lib/ai.ts` — GitHub Models client (OpenAI-compatible, `gpt-4o-mini`). Exports `generateText`, `generateJSON<T>`, `isAIEnabled`, `aiErrorMessage`, `checkAIRateLimit`. Gracefully no-ops without `GITHUB_MODELS_TOKEN` (same pattern as email). Returns typed `AIResult<T> = { ok: true; value: T } | { ok: false; error: AIError }`. `AIError` variants: `not_configured`, `no_credit`, `rate_limited`, `auth`, `no_access`, `bad_json`, `unknown` — always render via `aiErrorMessage(error)`, never expose the variant directly. Uses `fetch` directly against `https://models.github.ai/inference/chat/completions` — no SDK dependency.
- `src/lib/supabase.ts` — Server-only Supabase admin client (globalThis singleton like `prisma.ts`). Exports `ATTACHMENTS_BUCKET` constant and `removeAttachmentObjects(paths)` helper. Uses the service-role key — never import from client code.
- `src/lib/project-templates.ts` — Built-in project templates (Scrum, Bug Tracking, Product Launch, Website Redesign) with predefined tasks and labels.
- `src/lib/validations.ts` — Zod schemas for all form inputs.
- `src/lib/format.ts` — Small display helpers. `getInitials(name)` is the canonical implementation — do not re-derive inline.
- `src/types/index.ts` — NextAuth module augmentation (Session carries only `id` — role removed) + `ActionResult<T>` + `WorkspaceContext = { workspaceId, workspaceSlug, role }`.

**Path alias:** `@/*` maps to `./src/*`

## Key Patterns

**Server Actions, not REST.** All mutations go through server actions in `src/services/`. REST API routes are only for file downloads, CSV export, SSE, and cron. Forms use React 19 `useActionState`.

**ActionResult<T>** — Every mutation returns `{ success: true, data: T } | { success: false, error: string }`.

**Authorization.** JWT/Session carry only `id`. Role is resolved per-request:
- Server components under `/w/[slug]/`: call `requireWorkspaceMember(slug, userId)` — React.cache'd, so pages and actions in the same request share the result.
- Server actions invoked from client forms: call `resolveDefaultWorkspace(userId)` (the M1/M2 shim). It reads the `lastWorkspaceSlug` cookie first (kept in sync with URL by `proxy.ts`), falls back to first membership by `joinedAt`.
- `requireProjectMember(projectId, userId, ctx)` verifies `project.workspaceId === ctx.workspaceId` first (calls `notFound()` on mismatch — closes cross-workspace ID probing), then ADMIN bypass at the workspace level only, then `ProjectMember` lookup.
- Never add a new server action without deriving `ctx` and passing it through.

**NEXT_REDIRECT is an error.** `redirect()` throws a `NEXT_REDIRECT` error. Server actions that call `redirect()` must re-throw it — never swallow it in a try/catch. This has caused bugs before.

**Workspace role cache with 30s TTL.** `getCachedWorkspaceRole(userId, workspaceId)` in `src/lib/auth.ts` — in-process `globalThis` map keyed `${userId}:${workspaceId}`. Any code path that mutates `WorkspaceMember.role` or deletes a membership MUST call `invalidateWorkspaceRoleCache(userId, workspaceId)` right after. `invalidateAllWorkspaceRolesForUser(userId)` on user delete or workspace deletion.

**Optimistic UI on Kanban.** `KanbanBoard` applies drag-and-drop status changes and bulk operations optimistically, then calls the server action. On failure it reverts.

**Roles:** ADMIN, PROJECT_MANAGER, DEVELOPER, TESTER — all **per-workspace** (via `WorkspaceMember`), not global. Only ADMIN can access `/w/[slug]/admin` and invite users to that workspace. ADMIN of one workspace does NOT grant privileges in any other.

**Public signup.** Anyone can register. New user gets their own workspace + ADMIN role atomically (transaction in `register()`). Invitations (still workspace-scoped, still 32-byte hex + 7-day expiry) are for adding people to an existing workspace — M4 will rewrite the accept flow.

## Multi-tenant workspaces

Every registered user creates their own isolated workspace and becomes its ADMIN. Users can belong to multiple workspaces; roles are per-workspace (via `WorkspaceMember`), not global.

- `Workspace` — `id, name, slug @unique, createdById → User`.
- `WorkspaceMember` — `workspaceId + userId + role`, `@@unique([workspaceId, userId])`.
- `Project`, `Invitation`, `Notification` — carry `workspaceId` FK. `Project.key` uniqueness is `@@unique([workspaceId, key])` — Prisma names the compound field `workspaceId_key`, so `findUnique({ where: { key } })` must become `findUnique({ where: { workspaceId_key: { workspaceId, key } } })`.
- Everything else (Task, Sprint, Comment, Attachment, etc.) is workspace-scoped through `projectId → Project.workspaceId`.

**URL structure:** All app pages live under `/w/[workspaceSlug]/…`. Links to `/tasks/xyz` are broken — always use `/w/${workspaceSlug}/tasks/xyz`. In server components, get the slug from `params: Promise<{ workspaceSlug: string }>`. In client components, `const workspaceSlug = useParams().workspaceSlug as string;`.

**Signup flow:** `register()` in `auth-actions.ts` runs `prisma.$transaction([user + workspace + WorkspaceMember(ADMIN)])`. Workspace name auto-generated as `"{FirstName}'s Workspace"`, slug sanitized to kebab-case with `-2/-3` dedupe on unique conflict. No invite token, no first-user branch — `getSystemHasUsers`, `bootstrapAdmin`, and `/setup` are all deleted.

**Redirect chain:** Root `/` resolves the user's default workspace and redirects to `/w/{slug}/dashboard`, or to `/onboarding/create-workspace` if the user has no memberships (only reachable after being removed from every workspace).

## Next 16 proxy (was: middleware)

`src/proxy.ts` matches `/w/:path*` and writes the `lastWorkspaceSlug` cookie when it differs from the URL slug. This is the seam that lets client-invoked server actions (which can't read URL params) resolve to the correct workspace via `resolveDefaultWorkspace` — the cookie is the source of truth for "current workspace" in that context.

**Do NOT create `middleware.ts`** — Next 16 renamed the convention and errors when both files exist. Also, server components/layouts can't `cookies().set()` in Next 16; only Server Actions, Route Handlers, and `proxy.ts` can. If you need to mutate cookies from a layout, move it to `proxy.ts` or a Server Action.

## Testing

Vitest with mocked Prisma, auth, and Next.js APIs. Config in `vitest.config.mts`.

- Tests live in `src/__tests__/*.test.ts`
- Setup file (`src/__tests__/setup.ts`) mocks `next/cache` and `next/navigation` (redirect throws `NEXT_REDIRECT` like real Next.js)
- Each test file mocks `@/lib/prisma`, `@/lib/auth`, and `@/lib/authorization` with `vi.mock()`
- Run a single test file: `npx vitest run src/__tests__/auth-actions.test.ts`
- Current suites: `auth-actions.test.ts`, `admin-actions.test.ts`, `reorder-tasks.test.ts`, `export-reports-route.test.ts`, `lib-ai.test.ts`, `ai-actions-search.test.ts` — 68 tests, all green.
- When adding a test for a workspace-scoped action, mock `@/lib/authorization` with both `requireProjectMember` (returns true/false) and `resolveDefaultWorkspace` (returns `{ workspaceId, workspaceSlug, role }`). The session mock no longer has `role` — it's `{ user: { id, name, email } }`. Mirror the shape of `reorder-tasks.test.ts` for coverage of `ActionResult` + emitted SSE frame; mirror `admin-actions.test.ts` for anything workspace-scoped that touches `workspaceMember`.

## Database

15 Prisma models in `prisma/schema.prisma`. PostgreSQL hosted on Supabase (free tier), connected via the Session pooler on port 5432 (`aws-0-*.pooler.supabase.com`). Both `DATABASE_URL` and `DIRECT_URL` point at the pooler — the direct `db.<project>.supabase.co` endpoint is IPv6-only on free tier and unreachable from most local networks.

**Required query-string params on `DATABASE_URL`:** `?pgbouncer=true&connection_limit=10&pool_timeout=20`. Without `pgbouncer=true`, Prisma caches prepared statements that the pooler doesn't preserve across connections → P1017 "Server has closed the connection". `connection_limit=10` caps parallel connections since the pooler already multiplexes; `pool_timeout=20` gives `Promise.all` fan-outs (e.g. dashboard, activity page) enough time to acquire a slot.

Use `prisma db push` instead of `prisma migrate dev`.

**`prisma db push --force-reset` is gated by Prisma's Claude-Code guard** — refuses to run without `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` env var set to the user's exact consent message. Get a fresh explicit yes, pass their text as the env value, then run.

After a DB reset: clear browser cookies for localhost:3000 (stale JWT tokens reference deleted user IDs).

Seed data creates 4 users (admin@pms.dev, pm@pms.dev, dev@pms.dev, tester@pms.dev — all password `password123`) plus a sample project.

## File Attachments

Attachments live in Supabase **Storage** (private bucket `attachments`), NOT in Postgres. The DB row keeps metadata + `storagePath` (the object key `${taskId}/${uuid}-${sanitizedFilename}`); the file bytes live in Storage.

- **Upload** (`src/services/attachment-actions.ts` → `uploadAttachment`): sanitize filename to `[a-zA-Z0-9._-]`, upload to Storage, then create the DB row. Max 25MB.
- **Download** (`src/app/api/attachments/[id]/route.ts`): checks session + project membership, then 302-redirects to a 60-second signed URL. Response carries `Referrer-Policy: no-referrer` and `Cache-Control: private, no-store` so the token doesn't leak.
- **Delete cascade gotcha**: Prisma `onDelete: Cascade` on `Task → Attachment` removes rows but leaves Storage objects orphaned. `deleteTask` and `bulkDeleteTasks` in `task-actions.ts` explicitly call `removeAttachmentObjects()` from `lib/supabase.ts` **before** the DB delete. Any new code path that deletes tasks or projects must do the same.

## Error Handling

- `src/app/(dashboard)/error.tsx` — catches unhandled errors on any dashboard page. Shows a monochrome "Something went wrong" card with the error `digest` and a Try Again button.
- `src/app/(dashboard)/not-found.tsx` — 404 fallback for dashboard routes. Trigger explicitly with `notFound()` from `next/navigation` when a resource is missing.
- `src/app/global-error.tsx` — top-level fallback if the root layout itself throws; uses inline styles because Tailwind may not have loaded.

Server actions still return `ActionResult<T>` for expected failures — error boundaries are for genuinely unexpected throws (DB down, third-party outage).

## Dark Mode

CSS variables in `globals.css` with a `.dark` class on `<html>`. Managed by `ThemeProvider` in `src/components/features/theme-provider.tsx`; flash-prevention script runs `beforeInteractive` via `next/script` in `src/app/layout.tsx`.

**Critical config:** `globals.css` declares `@custom-variant dark (&:where(.dark, .dark *))`. Without this, Tailwind 4 defaults `dark:` variants to the OS media query and the theme toggle appears broken. Do not remove that line.

Global dark mode overrides in `globals.css` auto-adapt common utility classes (`.dark .text-zinc-900`, `.dark .bg-zinc-50`, etc.) so not every component needs explicit `dark:` variants for basic text/background colors.

## Real-Time Updates (SSE)

Server-Sent Events for live updates across browser sessions. Zero external dependencies.

- `src/lib/event-bus.ts` — In-memory pub/sub singleton (same `globalThis` pattern as `prisma.ts`). Channels: `project:{id}`, `user:{userId}`, `task:{id}`, `sprint:{id}`.
- `src/lib/sse-events.ts` — Typed event definitions (`SSEFrame` = `SSEEvent` + `_actorId`). Includes single-task and bulk events.
- `src/app/api/events/route.ts` — Authenticated SSE endpoint. Auto-subscribes to `user:{userId}` for notifications. 30s heartbeat.
- `src/hooks/use-event-stream.ts` — Client hook. Exponential backoff reconnection. Filters out own events via `_actorId` to avoid conflicts with optimistic UI.

**Adding a new real-time event**: Define the type in `sse-events.ts`, emit it in the server action via `eventBus.emit()`, handle it in the component via `useEventStream({ handlers })`.

**Key invariant**: Server actions still call `revalidatePath()` for the acting user. SSE provides updates to *other* users. The `_actorId` field prevents double-application.

**Exception**: subtask CRUD actions in `subtask-actions.ts` and `decomposeTask` in `ai-actions.ts` skip SSE emit intentionally — subtasks aren't real-time yet. If you add real-time subtasks, add a new `subtask:*` frame in `sse-events.ts` and wire it in `task-checklist.tsx`.

## Email Notifications

`src/lib/email.ts` uses Resend for transactional emails. If `RESEND_API_KEY` is not set, all email calls silently no-op — email is best-effort, never blocks the server action. Emails are sent for: task assignment, status changes, comments, project member additions, due-soon, and overdue reminders.

## Project Templates

`src/lib/project-templates.ts` defines built-in templates (Scrum Project, Bug Tracking, Product Launch, Website Redesign). Each template includes predefined labels and tasks. The `createProjectFromTemplate` server action in `project-actions.ts` creates the project, labels, and tasks in one transaction. No schema changes needed — templates are code-only.

## Bulk Task Operations

`bulkUpdateTasks` and `bulkDeleteTasks` in `task-actions.ts` operate on up to 50 tasks at once (status, priority, assignee changes or deletion). The KanbanBoard renders selection checkboxes on each task card and shows a bulk action toolbar when tasks are selected.

## Responsive Layout

The dashboard layout uses `DashboardShell` (client component in `src/components/features/dashboard-shell.tsx`) which manages mobile sidebar state. On desktop (`md:` breakpoint and up), the sidebar renders normally. On mobile, it's hidden and accessible via a hamburger menu that opens a fixed overlay with backdrop. The sidebar's `onNavigate` callback auto-closes it after tapping a nav link.

## Due-Date Reminders

`src/services/due-date-reminder-actions.ts` checks for overdue and due-soon tasks, sends in-app notifications and emails with 24h deduplication. **Only trigger:** `GET /api/cron/due-reminders`. In production, `CRON_SECRET` is **required** — the route returns 503 if it isn't set (fail-closed) and 401 for missing/wrong `Authorization: Bearer` in requests. In dev the secret is optional so you can hit the endpoint by hand. The dashboard used to also fire-and-forget this on every load but that was removed for perf — do not add it back to any page render path.

## AI features

`src/services/ai-actions.ts` holds four server actions backed by GitHub Models (`openai/gpt-4o-mini` via `lib/ai.ts`):

- `generateTaskDescription(title)` — Markdown Overview + Acceptance Criteria for the create-task form.
- `decomposeTask(taskId)` — creates 3–6 subtasks via `prisma.subtask.createMany`.
- `generateSprintRetro(sprintId)` — aggregates status/priority/assignee/time metrics, returns Markdown retro.
- `searchMyTasks(query)` — model returns a whitelisted JSON filter object (`status`, `priority`, `type`, `overdue`, `dueWithinDays`, `titleContains`); server sanitizes against enum lists before building the Prisma `where`. Never let the model produce raw Prisma.

`isAIAvailable()` is a server action every page uses to gate rendering of the AI controls. Pattern for adding a new AI action: `requireAuth` → membership check where applicable → `isAIEnabled()` → `rateLimit(session.user.id)` → `generateText`/`generateJSON` → sanitize/validate before touching Prisma or returning to the client.

**AI rate limiting.** `checkAIRateLimit(userId)` in `lib/ai.ts` enforces 20 requests per 5-minute sliding window, per user. The bucket `Map` is module-scoped — best-effort in serverless, not shared across containers. Every AI server action wraps this via the local `rateLimit()` helper in `ai-actions.ts`; do the same for new AI actions.

## Style direction

Notion/Vercel-inspired: airy cards (`rounded-2xl`, soft `0 1px 2px rgb(0 0 0 / 0.04)` shadow, `border-zinc-200/70`), monochrome primary buttons (`bg-zinc-900` / `dark:bg-zinc-100`, never hardcoded `bg-blue-600`), sentence-case section headings (`text-base font-semibold tracking-tight`, not `text-sm uppercase tracking-wide`). Exceptions kept uppercase intentionally: Kanban column labels and Linear-style form-field labels inside detail panels. Stat cards are flat: big number, small monochrome icon in the corner — no gradient-filled icon boxes.

## Style

No third-party UI component library. Everything is custom Tailwind with a zinc color palette. Icons from `lucide-react`. Geist font family via Next.js.

## Deployment

- Set all required env vars from the Environment Variables section.
- `DATABASE_URL` **must** include `?pgbouncer=true&connection_limit=10&pool_timeout=20` — without `pgbouncer=true`, Prisma will fail at runtime with P1017.
- Set `SUPABASE_SERVICE_ROLE_KEY` as a **server-only** env var (never `NEXT_PUBLIC_*` prefix).
- Wire `/api/cron/due-reminders` to an external scheduler (Vercel `vercel.json` cron, or equivalent) with header `Authorization: Bearer $CRON_SECRET`. The route returns 503 in prod if `CRON_SECRET` is unset.
- Run `npm run build` locally against production env before the first deploy — catches AFM font issues, missing envs, and Prisma client mismatches.

## Environment Variables

Required: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (the last two are needed for the attachments feature — uploads will fail without them).

Required in production only: `CRON_SECRET` (the `/api/cron/due-reminders` route returns 503 in prod if it's missing; optional in dev).

Optional: `DIRECT_URL` (Prisma migrations use it), `RESEND_API_KEY` and `EMAIL_FROM` (email notifications), `GITHUB_MODELS_TOKEN` (AI features via GitHub Models free tier; controls all `isAIAvailable()` gates).

**Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.** It bypasses Row Level Security. Import only from server-side modules (`src/lib/supabase.ts` is the single access point).
