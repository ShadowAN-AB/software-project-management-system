# Development Notes

## Current State (as of last session)

### What's Working
- Auth system (login/register with invite tokens)
- First user becomes ADMIN automatically
- Invite-based registration (admin creates invite → link with token → user registers with pre-assigned role)
- Admin panel with user management + invite management
- Project CRUD (ADMIN/PM only)
- Team management on project pages (add/remove members)
- Task CRUD with Kanban board (drag-and-drop)
- Task detail page (comments, labels, attachments)
- Sprint management
- Dashboard with stats
- Global search (Cmd+K)
- Notifications
- Activity timeline
- Reports & analytics
- Team workload view
- Settings (profile + password)
- **Dark mode** — System preference detection, light/dark/system toggle in sidebar, flash-free with inline script
- **Task dependencies** — Blocked-by / blocks relationships, circular dependency detection, visual indicators on blocked tasks
- **Time tracking** — Log hours/minutes per task, per-user entries, delete own entries, totals on task detail and sprint pages
- **Sprint burndown chart** — Pure SVG chart with ideal vs actual lines, hover tooltips, responsive

### New Schema Models
```
TaskDependency — blockedTaskId, blockerTaskId (unique pair, cascade delete)
TimeEntry — taskId, userId, minutes, description, date
```

### Before Running
```bash
cd pms-app
npx prisma db push      # Push new TaskDependency + TimeEntry tables
npx prisma generate     # Regenerate client with new models
npm run dev
```

### After DB Reset
- Clear browser cookies for localhost:3000 (stale JWT tokens)
- Register first user → becomes ADMIN
- Use Admin Panel to invite others

### New Files Added
- `src/components/features/theme-provider.tsx` — ThemeContext + provider
- `src/components/features/theme-toggle.tsx` — Light/Dark/System toggle
- `src/components/features/task-dependencies.tsx` — Dependency UI (blockedBy/blocks)
- `src/components/features/task-time-tracking.tsx` — Time logging UI
- `src/components/features/burndown-chart.tsx` — Pure SVG burndown chart
- `src/services/dependency-actions.ts` — CRUD + circular dependency check
- `src/services/time-tracking-actions.ts` — Log/delete time entries
- `src/services/burndown-actions.ts` — Generate burndown data from activity logs

### Files Modified
- `prisma/schema.prisma` — Added TaskDependency, TimeEntry models + relations
- `src/app/layout.tsx` — ThemeProvider wrapper, flash-prevention script
- `src/app/globals.css` — Dark mode CSS variables
- `src/app/(dashboard)/layout.tsx` — Dark mode classes
- `src/app/(dashboard)/tasks/[id]/page.tsx` — Dependencies + time tracking sections
- `src/app/(dashboard)/sprints/[id]/page.tsx` — Burndown chart + time summary
- `src/components/features/sidebar.tsx` — Theme toggle
- `src/components/ui/card.tsx` — Dark mode support
- `src/components/ui/button.tsx` — Dark mode support
- `src/components/ui/input.tsx` — Dark mode support

### Bugs Fixed This Session
1. **Login always failing** — `try/catch` swallowed `NEXT_REDIRECT`. Fixed by re-throwing redirect errors.
2. **No one can create projects** — All users were DEVELOPER. Fixed: first user gets ADMIN role.
3. **Kanban missing labels** — `getProject()` didn't include label relations. Fixed.
4. **Admin panel crashing** — `getInvitations()` failed when invitations table didn't exist. Fixed with try/catch fallback.
5. **Stale JWT after DB reset** — Old cookie has non-existent user ID. Fix: clear cookies after reset.

### Pending / Known Issues
- Neon free-tier DB may suspend — auto-wakes but causes cold-start errors
- The `signOut` button in sidebar uses `<form action="/api/auth/signout">` — may need testing
- No email sending for invites — admin must manually share the invite link
- Attachments stored as binary in DB (Bytes field) — fine for small files, not scalable for large ones
- Dark mode may need fine-tuning on some pages (reports, admin panel, login/register)
- Burndown chart uses activity logs — relies on status change logs containing "DONE"

## What to Build Next
- Email notifications (send actual emails for invites, task assignments)
- Real-time updates (WebSocket or SSE for live Kanban updates)
- File storage migration (S3/Cloudflare R2 instead of DB bytes)
- Drag-and-drop task ordering within columns
- Markdown support in task descriptions and comments
- Export reports as PDF/CSV
- Mobile-responsive improvements
- Deployment guide (Vercel + Neon)
