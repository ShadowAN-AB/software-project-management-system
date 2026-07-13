<div align="center">

# PMS — Project Management System

**A full-featured, multi-tenant project management app with AI-assisted planning, real-time collaboration, and email notifications — built on Next.js 16.**

[![Live Demo](https://img.shields.io/badge/demo-pms--app--mocha.vercel.app-black?style=for-the-badge)](https://pms-app-mocha.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](#license)

[Live demo](https://pms-app-mocha.vercel.app) · [Report a bug](https://github.com/ShadowAN-AB/software-project-management-system/issues) · [Request a feature](https://github.com/ShadowAN-AB/software-project-management-system/issues)

</div>

---

## Overview

PMS is a Jira/Linear-inspired project management tool designed to demonstrate a full production stack in a single Next.js app. Each user gets an isolated workspace, invites teammates, and runs projects with sprints, a drag-and-drop Kanban board, real-time notifications, email, and four AI actions powered by GitHub Models.

Everything is server-rendered, everything mutation lives in a Server Action, and every workspace is fully isolated at the database layer.

---

## Features

<table>
<tr>
<td width="50%">

### Core PM
- **Projects & tasks** — full CRUD, 5-column Kanban, Gantt view
- **Sprints** — start / complete lifecycle, burndown chart
- **Subtasks, dependencies, labels, comments, attachments**
- **Time tracking** — log hours per task
- **Bulk operations** — up to 50 tasks at once
- **Project templates** — Scrum, Bug Tracking, Product Launch, Website Redesign

</td>
<td width="50%">

### AI-assisted
- **Task description generator** — Markdown overview + acceptance criteria from a title
- **Task decomposition** — auto-generate 3–6 subtasks
- **Sprint retrospective** — full Markdown retro after sprint completes
- **Natural-language task search** — "overdue high priority bugs" → filtered results

All four run against `gpt-4o-mini` via GitHub Models (free tier), rate-limited to 20 req / 5 min per user.

</td>
</tr>
<tr>
<td width="50%">

### Multi-tenant & auth
- **Per-user workspaces** — every registrant gets their own workspace + ADMIN role
- **Cross-workspace invitations** — invite existing users, they can hold roles in many workspaces
- **RBAC per workspace** — ADMIN, PROJECT_MANAGER, DEVELOPER, TESTER
- **NextAuth v5** (JWT, Credentials)
- Cross-workspace ID probing returns 404 by design

</td>
<td width="50%">

### Real-time & notifications
- **Server-Sent Events** — live Kanban, notification bell, sprint state
- **In-app notifications** — task assigned, status changed, comment, mention, due-soon, overdue
- **Email (Resend)** — same events, HTML templates, workspace-scoped
- **Cron: due-date reminders** — with 24 h deduplication

</td>
</tr>
<tr>
<td width="50%">

### Storage & files
- **Attachments** in Supabase Storage (private bucket, 25 MB cap)
- **Signed URLs** with 60 s TTL + `Referrer-Policy: no-referrer`
- **CSV export** of tasks
- **PDF reports** via pdfkit

</td>
<td width="50%">

### UX polish
- **Dark mode** — `.dark` class, flash-prevention script, custom variant
- **Mobile responsive** — hamburger sidebar, stacked cards
- **Command palette** — `Cmd+K` global search
- **Notion / Vercel inspired** monochrome design
- **Zero component library** — custom Tailwind primitives

</td>
</tr>
</table>

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| UI | React 19, Tailwind CSS v4, Lucide icons |
| Auth | NextAuth v5 (JWT, Credentials) |
| Database | PostgreSQL on Supabase (free tier) |
| ORM | Prisma 6 |
| Storage | Supabase Storage (private bucket) |
| Email | Resend |
| AI | GitHub Models (`gpt-4o-mini`, OpenAI-compatible) |
| Real-time | Server-Sent Events (in-process pub/sub) |
| Validation | Zod |
| Testing | Vitest |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier fine)
- Optional: [Resend](https://resend.com) account for email, [GitHub Models](https://github.com/marketplace/models) token for AI

### Setup

```bash
git clone https://github.com/ShadowAN-AB/software-project-management-system.git
cd software-project-management-system/pms-app
npm install
cp .env.example .env
# fill in DATABASE_URL, NEXTAUTH_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npm run db:push
npm run db:seed          # optional — creates demo users + sample project
npm run dev
```

Open <http://localhost:3000> and log in with `admin@pms.dev` / `password123` (from seed).

### Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **yes** | Supabase pooler URL. See note below. |
| `DIRECT_URL` | yes | Same as `DATABASE_URL` for the pooler. |
| `NEXTAUTH_SECRET` | **yes** | JWT signing key. Generate with `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | **yes** | Your app URL, e.g. `http://localhost:3000`. |
| `SUPABASE_URL` | **yes** | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | Server-only, never exposed to client. |
| `CRON_SECRET` | prod only | Bearer token for `/api/cron/due-reminders`. |
| `RESEND_API_KEY` | optional | Enables email. Silently no-ops if unset. |
| `EMAIL_FROM` | optional | Sender identity, e.g. `PMS <no-reply@yourdomain.com>`. |
| `GITHUB_MODELS_TOKEN` | optional | Enables all 4 AI features. Silently no-ops if unset. |

**`DATABASE_URL` must include** `?pgbouncer=true&connection_limit=1&pool_timeout=40` — the `connection_limit=1` is deliberate for serverless. Supabase free-tier session pooler caps at 15 total connections across the account; each Vercel container opens its own Prisma pool, so anything higher throws `EMAXCONNSESSION` under real load.

### Deploy to Vercel

1. Push the `pms-app/` folder to GitHub.
2. Import the repo in Vercel, set the **root directory** to `pms-app`.
3. Add every env var above to Production (and Preview if you want previews to work).
4. Deploy — pushes to `main` auto-deploy.
5. On the first deploy, run `npm run db:push` locally against production `DATABASE_URL` to sync the schema.

Note: `postinstall: prisma generate` is already wired, so the Prisma client is always regenerated on Vercel builds.

---

## Architecture

### Layering

```
Pages → Feature Components → Server Actions → Prisma → PostgreSQL (Supabase)
```

All mutations flow through **Server Actions** in `src/services/`. The only REST routes are for streaming, downloads, and cron.

### Directory highlights

```
src/
├── app/
│   ├── (auth)/                     # login, register (no chrome)
│   ├── (dashboard)/
│   │   ├── w/[workspaceSlug]/     # all authenticated app pages
│   │   ├── invitations/           # cross-workspace pending invites
│   │   └── onboarding/            # first-workspace flow
│   └── api/                       # SSE, exports, attachments, invite/cron routes
├── components/
│   ├── ui/                        # custom primitives (no library)
│   └── features/                  # KanbanBoard, GanttChart, TaskDetail, ...
├── services/                      # 20 server-action modules
├── lib/
│   ├── auth.ts                    # NextAuth + workspace role cache
│   ├── authorization.ts           # requireWorkspaceMember, requireProjectMember
│   ├── ai.ts                      # GitHub Models client + rate limit
│   ├── email.ts                   # Resend integration
│   ├── event-bus.ts               # in-memory SSE pub/sub
│   ├── supabase.ts                # Storage admin client
│   └── validations.ts             # Zod schemas
└── proxy.ts                       # Next 16 middleware equivalent
```

### Multi-tenant isolation

Every registered user gets their own `Workspace` and becomes its `ADMIN`. Roles are **per-workspace**, not global. All app pages live under `/w/[workspaceSlug]/…`. `requireProjectMember()` verifies `project.workspaceId === ctx.workspaceId` first — if it doesn't match, the request calls `notFound()`, so cross-workspace ID probing is impossible.

### Real-time (SSE)

`src/lib/event-bus.ts` is an in-memory pub/sub singleton. Channels: `project:{id}`, `user:{userId}`, `task:{id}`, `sprint:{id}`, and workspace-scoped `user:{userId}:workspace:{workspaceId}` for notifications. Client hook `useEventStream` reconnects with exponential backoff and filters its own emits via an `_actorId` field so optimistic UI doesn't double-apply.

### AI actions

`src/services/ai-actions.ts` holds all four features. Every action follows the same shape:

```
requireAuth → membership check → isAIEnabled → rateLimit → generate → sanitize → persist
```

For `searchMyTasks`, the model returns a JSON filter object which the server sanitizes against an enum whitelist before building the Prisma `where` — the model never emits raw Prisma.

---

## Testing

```bash
npm run test              # vitest run (68 tests)
npm run test:watch        # vitest --watch
npx vitest run src/__tests__/auth-actions.test.ts  # single file
```

Tests mock `@/lib/prisma`, `@/lib/auth`, and `@/lib/authorization`. The setup file mocks `next/cache` and `next/navigation` so `redirect()` throws `NEXT_REDIRECT` like real Next.

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Turbopack dev server on `:3000` |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run test` | Vitest run |
| `npm run db:push` | Sync `schema.prisma` → DB (preferred over `migrate`) |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:seed` | Seed demo users + sample project |
| `npm run db:studio` | Visual DB browser |

---

## Seed Data

`npm run db:seed` creates a `Demo Workspace` with these users (password: `password123`):

| Email | Name | Workspace role |
|---|---|---|
| `admin@pms.dev` | Admin User | ADMIN |
| `pm@pms.dev` | Sarah Connor | PROJECT_MANAGER |
| `dev@pms.dev` | John Doe | DEVELOPER |
| `tester@pms.dev` | Jane Smith | TESTER |

Plus a sample project **PMS — Project Management System** with the seeded users as members.

---

## Roadmap

- [ ] Real-time subtasks (currently non-SSE)
- [ ] Kanban render-tree memoization for very large boards
- [ ] GitHub / Slack integrations
- [ ] Reduce PDF cold-start on Vercel (font bundling)
- [ ] Move Supabase pooler to transaction mode to raise the connection ceiling

---

## Troubleshooting

**`FATAL: (EMAXCONNSESSION)` in prod logs** — `DATABASE_URL` needs `connection_limit=1` for Vercel. See Env Variables.

**`P1001 Can't reach database server` locally** — usually SSE holds starving the pool during dev. Restart `npm run dev` or bump `pool_timeout`.

**`P1017 server has closed the connection`** — you're missing `pgbouncer=true` in `DATABASE_URL`.

**"Configuration" auth error** — `NEXTAUTH_SECRET` or `NEXTAUTH_URL` mismatch, or `DATABASE_URL` failed on the auth callback.

**AI buttons don't appear** — `GITHUB_MODELS_TOKEN` isn't set. `isAIAvailable()` returns false and the UI gates hide.

**Emails don't arrive** — Resend requires a verified sender domain. Unverified senders can only deliver to the account owner's email.

---

## License

MIT © [Abdullah Naseem](https://github.com/ShadowAN-AB)

---

<div align="center">

Built with Next.js 16, Prisma 6, Supabase, NextAuth v5, and GitHub Models.

</div>
