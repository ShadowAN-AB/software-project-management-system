# PMS — Project Management System

A full-stack project management tool built with Next.js 16, featuring Kanban boards, sprint planning, RBAC, invite-based registration, and team workload analytics.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript (strict)
- **UI**: React 19, Tailwind CSS v4, Lucide Icons
- **Auth**: NextAuth v5 (beta) — Credentials provider, JWT sessions
- **Database**: PostgreSQL (Neon cloud)
- **ORM**: Prisma 6.x
- **Validation**: Zod
- **Date Utils**: date-fns

---

## Getting Started

### Prerequisites

- Node.js 18+
- A PostgreSQL database (Neon recommended for free hosting)

### Setup

```bash
# Clone and install
cd pms-app
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database URL and secrets

# Push schema to database and generate client
npx prisma db push
npx prisma generate

# Start dev server
npm run dev
```

Open `http://localhost:3000`.

### Environment Variables

```env
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"
DIRECT_URL="postgresql://user:password@host:5432/dbname?sslmode=require"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
```

For Neon: use the **direct** (non-pooler) connection string for both `DATABASE_URL` and `DIRECT_URL`.

### Database Commands

```bash
npx prisma db push                # Sync schema to DB (no migrations)
npx prisma db push --force-reset  # Wipe DB and recreate tables
npx prisma generate               # Regenerate Prisma client after schema changes
npx prisma studio                  # Open visual DB browser
npx prisma db seed                 # Seed demo data (admin@pms.dev / password123)
```

---

## Architecture

### Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth route group (no sidebar/nav)
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/              # Dashboard route group (with sidebar)
│   │   ├── layout.tsx            # Sidebar + header + notification bell
│   │   ├── dashboard/page.tsx    # Main dashboard with stats
│   │   ├── projects/
│   │   │   ├── page.tsx          # Project list
│   │   │   ├── new/page.tsx      # Create project form
│   │   │   └── [id]/page.tsx     # Project detail + Kanban + team
│   │   ├── tasks/
│   │   │   ├── page.tsx          # My Tasks (filtered by assignee)
│   │   │   └── [id]/page.tsx     # Task detail + comments + labels + attachments
│   │   ├── sprints/
│   │   │   ├── page.tsx          # Sprint list
│   │   │   ├── new/page.tsx      # Create sprint
│   │   │   └── [id]/page.tsx     # Sprint detail
│   │   ├── admin/page.tsx        # Admin panel (users, invites, stats)
│   │   ├── activity/page.tsx     # Activity timeline
│   │   ├── reports/page.tsx      # Analytics & charts
│   │   ├── workload/page.tsx     # Team workload heatmap
│   │   ├── notifications/page.tsx
│   │   ├── settings/page.tsx     # Profile & password
│   │   └── setup/page.tsx        # Bootstrap admin (first-time setup)
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── attachments/[id]/route.ts   # File download
│   │   └── invite/validate/route.ts    # Invite token validation
│   ├── page.tsx                  # Landing page
│   └── globals.css               # Tailwind v4 + custom utilities
│
├── components/
│   ├── ui/                       # Reusable primitives
│   │   ├── button.tsx            # Button with loading state
│   │   ├── card.tsx              # Card, CardHeader, CardContent
│   │   ├── input.tsx             # Input with label
│   │   └── badge.tsx             # StatusBadge, PriorityBadge
│   └── features/                 # Domain components
│       ├── sidebar.tsx           # Dark sidebar with role-based nav
│       ├── kanban-board.tsx      # Drag-and-drop task board
│       ├── create-task-form.tsx  # Inline task creation
│       ├── task-detail.tsx       # Task editing (status, priority, assignee)
│       ├── task-labels.tsx       # Label management on tasks
│       ├── task-attachments.tsx  # File upload/download
│       ├── comment-thread.tsx    # Task comments
│       ├── team-management.tsx   # Add/remove project members
│       ├── user-management.tsx   # Admin: role changes, delete users
│       ├── invite-management.tsx # Admin: create/revoke invitations
│       ├── project-overview.tsx  # Project stats, sprint timeline
│       ├── team-workload.tsx     # Capacity heatmap
│       ├── reports-charts.tsx    # Analytics visualizations
│       ├── activity-timeline.tsx # Activity feed
│       ├── sprint-actions.tsx    # Sprint start/complete controls
│       ├── search-command.tsx    # Global search (Cmd+K)
│       ├── notification-bell.tsx # Header notification dropdown
│       ├── notification-actions-client.tsx
│       ├── profile-form.tsx      # Settings: update name/email
│       └── password-form.tsx     # Settings: change password
│
├── services/                     # Server Actions (all mutations)
│   ├── auth-actions.ts           # login, register, getSystemHasUsers
│   ├── project-actions.ts        # CRUD projects, add/remove members
│   ├── task-actions.ts           # CRUD tasks, update status/order
│   ├── sprint-actions.ts         # CRUD sprints, start/complete
│   ├── admin-actions.ts          # Admin stats, user management, bootstrap
│   ├── invite-actions.ts         # Create/revoke/validate invitations
│   ├── label-actions.ts          # CRUD labels, add/remove from tasks
│   ├── attachment-actions.ts     # Upload/delete file attachments
│   ├── notification-actions.ts   # CRUD notifications
│   ├── dashboard-actions.ts      # Dashboard aggregation queries
│   ├── overview-actions.ts       # Project overview + team workload data
│   ├── reports-actions.ts        # Analytics data aggregation
│   ├── activity-actions.ts       # Activity log queries
│   ├── search-actions.ts         # Global search across entities
│   └── settings-actions.ts       # Profile/password updates
│
├── lib/
│   ├── auth.ts                   # NextAuth config (JWT + role refresh)
│   ├── prisma.ts                 # Singleton PrismaClient
│   ├── validations.ts            # Zod schemas for all forms
│   └── date-utils.ts             # Date formatting helpers
│
├── types/
│   └── index.ts                  # NextAuth module augmentation + ActionResult<T>
│
└── middleware.ts                  # Auth middleware (protected routes)
```

### Key Patterns

**Server Actions for all mutations** — No REST API except file downloads. All form submissions use React 19 `useActionState` + server actions.

**ActionResult<T> type** — Standardized return type for all mutations:
```typescript
type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
```

**JWT with live role refresh** — The NextAuth JWT callback queries the database on every request to pick up role changes immediately (no logout needed after admin promotes a user).

**NEXT_REDIRECT handling** — Next.js `redirect()` throws `NEXT_REDIRECT` errors. Server actions that call `redirect()` must not catch these in try/catch blocks — they must be re-thrown.

---

## Database Schema

12 models in PostgreSQL via Prisma:

```
User              — id, email, name, passwordHash, role, avatarUrl
Project           — id, name, key (unique), description, status, dates
ProjectMember     — userId + projectId (unique pair), role
Task              — id, title, description, status, priority, type, order, dueDate
Sprint            — id, name, goal, status, startDate, endDate, projectId
Comment           — id, content, taskId, userId
ActivityLog       — id, action, details, userId, projectId?, taskId?
Notification      — id, type, title, message, read, link, userId
Attachment        — id, filename, fileSize, mimeType, data (bytes), taskId
Label             — id, name, color, projectId
TaskLabel         — taskId + labelId (join table)
Invitation        — id, email, role, token, expiresAt, usedAt, invitedById
```

### Enums

- **Role**: `ADMIN`, `PROJECT_MANAGER`, `DEVELOPER`, `TESTER`
- **ProjectStatus**: `PLANNING`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `ARCHIVED`
- **TaskStatus**: `BACKLOG`, `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`
- **TaskPriority**: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- **TaskType**: `FEATURE`, `BUG`, `IMPROVEMENT`, `TASK`
- **SprintStatus**: `PLANNING`, `ACTIVE`, `COMPLETED`

---

## RBAC (Role-Based Access Control)

| Feature                  | ADMIN | PROJECT_MANAGER | DEVELOPER | TESTER |
|--------------------------|-------|-----------------|-----------|--------|
| Create projects          | Yes   | Yes             | No        | No     |
| Manage project members   | Yes   | Yes             | No        | No     |
| Create/manage sprints    | Yes   | Yes             | No        | No     |
| Create/edit tasks        | Yes   | Yes             | Yes       | Yes    |
| Move tasks on Kanban     | Yes   | Yes             | Yes       | Yes    |
| Add comments             | Yes   | Yes             | Yes       | Yes    |
| Upload attachments       | Yes   | Yes             | Yes       | Yes    |
| View workload page       | Yes   | Yes             | No        | No     |
| Admin panel              | Yes   | No              | No        | No     |
| Invite team members      | Yes   | No              | No        | No     |
| Change user roles        | Yes   | No              | No        | No     |

---

## Invite System

Public registration is disabled. Only invited users can join (except the first user who becomes ADMIN).

### Flow

1. **Bootstrap**: First registered user automatically becomes `ADMIN`
2. **Admin invites**: Admin Panel → Invite Team Member → enters email + selects role → clicks Invite
3. **Link generated**: `http://localhost:3000/register?token=<64-char-hex>` (auto-copied to clipboard)
4. **Admin shares link**: Via email, Slack, etc.
5. **User registers**: Opens link → sees pre-assigned role → fills name + password → account created with the invited role
6. **Invite expires**: After 7 days if unused
7. **Admin manages**: Can revoke pending invites, see used/expired history

### Security

- Tokens are 32-byte random hex (crypto.randomBytes)
- Email must match the invitation exactly
- Tokens expire after 7 days
- Each token is single-use (marked with `usedAt` timestamp)
- Without a valid token, `/register` returns "Registration requires an invitation"

---

## Features

### Dashboard
- Stat cards (projects, tasks, in-progress, completed)
- My Tasks list with status badges
- Active Sprints with progress bars
- Recent Activity feed
- No-admin bootstrap banner (when system has no admin)

### Projects
- Project list with member count and task count
- Create project form (name, key, description, dates)
- Project detail page with:
  - Project overview (progress, sprint timeline, team distribution)
  - Inline task creation form
  - Kanban board (5 columns: Backlog → Todo → In Progress → In Review → Done)
  - Team management (add/remove members with role selection)

### Kanban Board
- Drag-and-drop between status columns
- Task cards show: title, priority badge, type badge, assignee, due date, label chips, comment count
- Overdue highlighting (red badges for past-due tasks)

### Tasks
- "My Tasks" page filtered by current user's assignments
- Task detail page with:
  - Editable fields: title, description, status, priority, type, assignee, sprint, due date
  - Comment thread (add/view comments)
  - Labels (add existing, create new with color picker, remove)
  - File attachments (upload with drag-and-drop, download, delete)

### Sprints
- Sprint list with status and date range
- Create sprint with goal, dates, project selection
- Sprint detail with task list
- Start/complete sprint actions (for ADMIN/PM)

### Admin Panel
- System stats (users, projects, tasks, admin count)
- Role distribution visualization
- Invite management (create, revoke, copy links, view history)
- User management table (change roles via dropdown, delete users)

### Notifications
- In-app notification system
- Bell icon in header with unread count
- Notification types: task assigned, status changed, comment added, project added, sprint started, mentioned
- Mark as read / mark all as read

### Search
- Global search (Cmd+K shortcut)
- Searches across projects, tasks, and users
- Results grouped by entity type

### Reports & Analytics
- Task status distribution
- Priority breakdown
- Team productivity metrics
- Sprint velocity data

### Activity Timeline
- Chronological log of all system actions
- Filterable by project
- Shows user, action, timestamp

### Team Workload
- Per-member capacity heatmap (Available / Light / Moderate / Heavy)
- Active tasks, completed this week, overdue counts
- Priority breakdown per team member
- Expandable task lists

### Settings
- Profile editing (name, email)
- Password change

---

## Known Issues & Notes

### NextAuth v5 + Next.js 16 Quirks

- `signIn()` throws on both failure AND success (redirect case). The login action checks for `NEXT_REDIRECT` digest and re-throws it.
- `redirect()` in server actions throws `NEXT_REDIRECT` — never catch it in try/catch.
- JWT role is refreshed from DB on every request to ensure role changes take effect immediately.

### Neon Database

- Free-tier databases suspend after inactivity — they auto-wake on connection but may cause a cold-start delay.
- Use `npx prisma db push` instead of `prisma migrate dev` (advisory lock issues with Neon).
- Both `DATABASE_URL` and `DIRECT_URL` should use the direct (non-pooler) connection string.

### Development

- After schema changes: run `npx prisma db push` then `npx prisma generate`
- After DB reset: clear browser cookies (JWT has stale user IDs)
- The seed script creates 4 users: admin@pms.dev, pm@pms.dev, dev@pms.dev, tester@pms.dev (all with password: `password123`)

---

## Seed Data

Run `npx prisma db seed` to create demo users and a sample project:

| Email           | Password     | Role             |
|-----------------|-------------|------------------|
| admin@pms.dev   | password123 | ADMIN            |
| pm@pms.dev      | password123 | PROJECT_MANAGER  |
| dev@pms.dev     | password123 | DEVELOPER        |
| tester@pms.dev  | password123 | TESTER           |

Plus a sample project "Project Management System" (key: PMS) with all 4 users as members.

---

## Scripts

```bash
npm run dev          # Start development server (Turbopack)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
npm run db:generate  # prisma generate
npm run db:push      # prisma db push
npm run db:migrate   # prisma migrate dev
npm run db:seed      # Run seed script
npm run db:studio    # Open Prisma Studio
```

---

## Build History

This project was built incrementally across multiple sessions:

1. Scaffolded Next.js 16 + TypeScript + Tailwind v4 + Prisma
2. Designed Prisma schema (11 models, later expanded to 12 with Invitation)
3. Built auth system (NextAuth v5, JWT, RBAC)
4. Built Projects module (CRUD + team management)
5. Built Tasks module (CRUD + Kanban board with drag-and-drop)
6. Built Sprints module
7. Built Dashboard with analytics
8. Polished UI: design tokens, dark sidebar, zinc palette
9. Built task detail page with comments
10. Built admin panel with user management
11. Built notifications system
12. Built global search (Cmd+K)
13. Built settings page (profile + password)
14. Built reports & analytics
15. Built file attachments for tasks
16. Built activity timeline
17. Built due date reminders & overdue highlighting
18. Built task labels/tags system
19. Built project overview dashboard
20. Built team workload view
21. Fixed critical bugs (login redirect, first-user admin, missing label data)
22. Built invite-based registration system (replaced public registration)
23. Built team management UI (add/remove project members)
