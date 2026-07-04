# PMS - Project Management System

Full-stack project management system built with Next.js 16, TypeScript, Prisma, and PostgreSQL.

## Features

- **Authentication** — NextAuth.js with credentials provider, JWT sessions
- **RBAC** — Admin, Project Manager, Developer, Tester roles
- **Projects** — CRUD, team member management, project status tracking
- **Tasks** — Full lifecycle with Kanban board, drag-and-drop status changes
- **Sprints** — Planning, active, completed states with progress tracking
- **Dashboard** — Role-aware stats, my tasks, active sprints, activity feed
- **Activity Logging** — Automatic audit trail for all actions

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js v5 (beta)
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React

## Prerequisites

- Node.js 18+
- PostgreSQL database
- npm

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and configure
cp .env.example .env
# Edit .env with your DATABASE_URL and NEXTAUTH_SECRET

# 3. Generate Prisma client
npm run db:generate

# 4. Push schema to database (or use migrations)
npm run db:push
# OR: npm run db:migrate

# 5. Seed test data
npm run db:seed

# 6. Run dev server
npm run dev
```

Open http://localhost:3000

## Test Accounts (after seeding)

| Email | Password | Role |
|-------|----------|------|
| admin@pms.dev | password123 | Admin |
| pm@pms.dev | password123 | Project Manager |
| dev@pms.dev | password123 | Developer |
| tester@pms.dev | password123 | Tester |

## Project Structure

```
src/
  app/
    (auth)/           # Login, Register pages
    (dashboard)/      # Protected pages with sidebar layout
      dashboard/      # Main dashboard
      projects/       # Projects list, detail, new
      tasks/          # My tasks view
      sprints/        # Sprints list, detail, new
    api/auth/         # NextAuth route handler
  components/
    ui/               # Button, Input, Badge, Card
    features/         # Sidebar, KanbanBoard, CreateTaskForm, SprintActions
  lib/                # Prisma client, auth config, validations (Zod)
  services/           # Server actions (auth, projects, tasks, sprints, dashboard)
  types/              # TypeScript type augmentations
prisma/
  schema.prisma       # Database schema
  seed.ts             # Test data seeder
```

## Role Permissions

- **Admin**: Full access to everything
- **Project Manager**: Create projects/sprints, manage tasks
- **Developer**: View assigned projects, manage own tasks
- **Tester**: View assigned projects, manage own tasks

Public registration creates Developer accounts by default.
