import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks -----------------------------------------------------------

const mockSession = {
  user: { id: "admin-1", name: "Admin", email: "admin@test.com" },
};
const mockCtx = {
  workspaceId: "w1",
  workspaceSlug: "acme",
  role: "ADMIN" as const,
};

const mockAuth = vi.fn();
const mockInvalidateWorkspaceRoleCache = vi.fn();
const mockInvalidateAllWorkspaceRolesForUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
  invalidateWorkspaceRoleCache: mockInvalidateWorkspaceRoleCache,
  invalidateAllWorkspaceRolesForUser: mockInvalidateAllWorkspaceRolesForUser,
}));

const mockResolveDefaultWorkspace = vi.fn();
vi.mock("@/lib/authorization", () => ({
  resolveDefaultWorkspace: mockResolveDefaultWorkspace,
}));

const mockPrisma = {
  workspaceMember: {
    count: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
    groupBy: vi.fn(),
  },
  project: { count: vi.fn() },
  task: {
    count: vi.fn(),
    updateMany: vi.fn(),
  },
  projectMember: { deleteMany: vi.fn() },
  comment: { deleteMany: vi.fn() },
  activityLog: { deleteMany: vi.fn() },
  user: { delete: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// --- Helpers ----------------------------------------------------------

function asAdmin() {
  mockAuth.mockResolvedValue(mockSession);
  mockResolveDefaultWorkspace.mockResolvedValue(mockCtx);
}

function asDeveloper() {
  mockAuth.mockResolvedValue({
    user: { id: "dev-1", name: "Dev", email: "dev@test.com" },
  });
  mockResolveDefaultWorkspace.mockResolvedValue({ ...mockCtx, role: "DEVELOPER" as const });
}

function asUnauthenticated() {
  mockAuth.mockResolvedValue(null);
  mockResolveDefaultWorkspace.mockResolvedValue(null);
}

// --- Tests ------------------------------------------------------------

describe("admin-actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  async function loadModule() {
    return import("@/services/admin-actions");
  }

  // ── requireAdmin gate ──────────────────────────────────────────────

  describe("requireAdmin gate", () => {
    it("throws when unauthenticated", async () => {
      const { getAdminStats } = await loadModule();
      asUnauthenticated();
      await expect(getAdminStats()).rejects.toThrow("Admin access required");
    });

    it("throws when the workspace role is not ADMIN", async () => {
      const { getAdminStats } = await loadModule();
      asDeveloper();
      await expect(getAdminStats()).rejects.toThrow("Admin access required");
    });
  });

  // ── getAdminStats ──────────────────────────────────────────────────

  describe("getAdminStats", () => {
    it("returns workspace-scoped stats for an admin", async () => {
      const { getAdminStats } = await loadModule();
      asAdmin();

      mockPrisma.workspaceMember.count.mockResolvedValue(5);
      mockPrisma.project.count.mockResolvedValue(3);
      mockPrisma.task.count.mockResolvedValue(20);
      mockPrisma.workspaceMember.findMany.mockResolvedValue([
        {
          role: "ADMIN",
          joinedAt: new Date(),
          user: { id: "u1", name: "Alice", email: "a@t.com" },
        },
      ]);
      mockPrisma.workspaceMember.groupBy.mockResolvedValue([
        { role: "ADMIN", _count: 1 },
        { role: "DEVELOPER", _count: 4 },
      ]);

      const stats = await getAdminStats();

      expect(stats.userCount).toBe(5);
      expect(stats.projectCount).toBe(3);
      expect(stats.taskCount).toBe(20);
      expect(stats.recentUsers).toHaveLength(1);
      expect(stats.recentUsers[0]).toMatchObject({ id: "u1", name: "Alice", role: "ADMIN" });
      expect(stats.roleDistribution).toEqual({ ADMIN: 1, DEVELOPER: 4 });

      // Every query must scope to ctx.workspaceId.
      expect(mockPrisma.workspaceMember.count).toHaveBeenCalledWith({
        where: { workspaceId: "w1" },
      });
      expect(mockPrisma.project.count).toHaveBeenCalledWith({
        where: { workspaceId: "w1" },
      });
    });
  });

  // ── getAdminUsers ──────────────────────────────────────────────────

  describe("getAdminUsers", () => {
    it("returns workspace members with role for admins", async () => {
      const { getAdminUsers } = await loadModule();
      asAdmin();

      const members = [
        {
          role: "PROJECT_MANAGER",
          user: {
            id: "u1",
            name: "Alice",
            email: "a@t.com",
            _count: { assignedTasks: 2, createdTasks: 5, projectMemberships: 1 },
          },
        },
      ];
      mockPrisma.workspaceMember.findMany.mockResolvedValue(members);

      const result = await getAdminUsers();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: "u1", name: "Alice", role: "PROJECT_MANAGER" });
      expect(mockPrisma.workspaceMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { workspaceId: "w1" } })
      );
    });

    it("rejects non-admin", async () => {
      const { getAdminUsers } = await loadModule();
      asDeveloper();
      await expect(getAdminUsers()).rejects.toThrow("Admin access required");
    });
  });

  // ── updateUserRole ─────────────────────────────────────────────────

  describe("updateUserRole", () => {
    it("updates the target member's workspace role and invalidates their cache", async () => {
      const { updateUserRole } = await loadModule();
      asAdmin();
      mockPrisma.workspaceMember.update.mockResolvedValue({});

      const result = await updateUserRole("other-user", "PROJECT_MANAGER");

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockPrisma.workspaceMember.update).toHaveBeenCalledWith({
        where: { workspaceId_userId: { workspaceId: "w1", userId: "other-user" } },
        data: { role: "PROJECT_MANAGER" },
      });
      expect(mockInvalidateWorkspaceRoleCache).toHaveBeenCalledWith("other-user", "w1");
    });

    it("prevents admin from changing their own role", async () => {
      const { updateUserRole } = await loadModule();
      asAdmin();

      const result = await updateUserRole("admin-1", "DEVELOPER");

      expect(result).toEqual({ success: false, error: "Cannot change your own role" });
      expect(mockPrisma.workspaceMember.update).not.toHaveBeenCalled();
    });

    it("rejects non-admin", async () => {
      const { updateUserRole } = await loadModule();
      asDeveloper();

      await expect(updateUserRole("someone", "ADMIN")).rejects.toThrow("Admin access required");
    });
  });

  // ── getAdminCount ──────────────────────────────────────────────────

  describe("getAdminCount", () => {
    it("counts admins across all workspaces", async () => {
      const { getAdminCount } = await loadModule();
      mockPrisma.workspaceMember.count.mockResolvedValue(4);

      const result = await getAdminCount();
      expect(result).toBe(4);
      expect(mockPrisma.workspaceMember.count).toHaveBeenCalledWith({ where: { role: "ADMIN" } });
    });
  });

  // ── deleteUser ─────────────────────────────────────────────────────

  describe("deleteUser", () => {
    it("prevents admin from deleting themselves", async () => {
      const { deleteUser } = await loadModule();
      asAdmin();

      const result = await deleteUser("admin-1");

      expect(result).toEqual({ success: false, error: "Cannot delete your own account" });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("deletes another user through a transaction and clears all their role caches", async () => {
      const { deleteUser } = await loadModule();
      asAdmin();
      mockPrisma.$transaction.mockResolvedValue(undefined);

      const result = await deleteUser("other-user");

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      const txArg = mockPrisma.$transaction.mock.calls[0][0];
      // 7-op transaction now (task assignee null / task creator null / projectMember / workspaceMember / comment / activity / user)
      expect(txArg).toHaveLength(7);
      expect(mockInvalidateAllWorkspaceRolesForUser).toHaveBeenCalledWith("other-user");
    });

    it("rejects non-admin", async () => {
      const { deleteUser } = await loadModule();
      asDeveloper();

      await expect(deleteUser("some-user")).rejects.toThrow("Admin access required");
    });

    it("rejects unauthenticated user", async () => {
      const { deleteUser } = await loadModule();
      asUnauthenticated();

      await expect(deleteUser("some-user")).rejects.toThrow("Admin access required");
    });
  });
});
