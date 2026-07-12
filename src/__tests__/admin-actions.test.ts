import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks -----------------------------------------------------------

const mockSession = {
  user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" as const },
};

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
  invalidateRoleCache: vi.fn(),
}));

const mockPrisma = {
  user: {
    count: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// --- Helpers ----------------------------------------------------------

function asAdmin() {
  mockAuth.mockResolvedValue(mockSession);
}

function asDeveloper() {
  mockAuth.mockResolvedValue({
    user: { id: "dev-1", name: "Dev", email: "dev@test.com", role: "DEVELOPER" },
  });
}

function asUnauthenticated() {
  mockAuth.mockResolvedValue(null);
}

// --- Tests ------------------------------------------------------------

describe("admin-actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  async function loadModule() {
    return import("@/services/admin-actions");
  }

  // ── requireAdmin (tested via getAdminStats) ────────────────────────

  describe("requireAdmin gate", () => {
    it("throws when unauthenticated", async () => {
      const { getAdminStats } = await loadModule();
      asUnauthenticated();

      await expect(getAdminStats()).rejects.toThrow("Admin access required");
    });

    it("throws when user is not ADMIN", async () => {
      const { getAdminStats } = await loadModule();
      asDeveloper();

      await expect(getAdminStats()).rejects.toThrow("Admin access required");
    });
  });

  // ── getAdminStats ──────────────────────────────────────────────────

  describe("getAdminStats", () => {
    it("returns stats for admin user", async () => {
      const { getAdminStats } = await loadModule();
      asAdmin();
      mockPrisma.user.count.mockResolvedValue(5);
      mockPrisma.project.count.mockResolvedValue(3);
      mockPrisma.task.count.mockResolvedValue(20);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: "u1", name: "Alice", email: "a@t.com", role: "ADMIN", createdAt: new Date() },
      ]);
      mockPrisma.user.groupBy.mockResolvedValue([
        { role: "ADMIN", _count: 1 },
        { role: "DEVELOPER", _count: 4 },
      ]);

      const stats = await getAdminStats();

      expect(stats.userCount).toBe(5);
      expect(stats.projectCount).toBe(3);
      expect(stats.taskCount).toBe(20);
      expect(stats.recentUsers).toHaveLength(1);
      expect(stats.roleDistribution).toEqual({ ADMIN: 1, DEVELOPER: 4 });
    });
  });

  // ── getAdminUsers ──────────────────────────────────────────────────

  describe("getAdminUsers", () => {
    it("returns user list for admin", async () => {
      const { getAdminUsers } = await loadModule();
      asAdmin();
      const users = [{ id: "u1", name: "Alice", _count: { assignedTasks: 2, createdTasks: 5, projectMemberships: 1 } }];
      mockPrisma.user.findMany.mockResolvedValue(users);

      const result = await getAdminUsers();
      expect(result).toEqual(users);
    });

    it("rejects non-admin", async () => {
      const { getAdminUsers } = await loadModule();
      asDeveloper();

      await expect(getAdminUsers()).rejects.toThrow("Admin access required");
    });
  });

  // ── updateUserRole ─────────────────────────────────────────────────

  describe("updateUserRole", () => {
    it("updates role for another user", async () => {
      const { updateUserRole } = await loadModule();
      asAdmin();
      mockPrisma.user.update.mockResolvedValue({});

      const result = await updateUserRole("other-user", "PROJECT_MANAGER");

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "other-user" },
        data: { role: "PROJECT_MANAGER" },
      });
    });

    it("prevents admin from changing own role", async () => {
      const { updateUserRole } = await loadModule();
      asAdmin();

      const result = await updateUserRole("admin-1", "DEVELOPER");

      expect(result).toEqual({ success: false, error: "Cannot change your own role" });
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("rejects non-admin", async () => {
      const { updateUserRole } = await loadModule();
      asDeveloper();

      await expect(updateUserRole("someone", "ADMIN")).rejects.toThrow("Admin access required");
    });
  });

  // ── bootstrapAdmin ─────────────────────────────────────────────────

  describe("bootstrapAdmin", () => {
    it("returns error when not authenticated", async () => {
      const { bootstrapAdmin } = await loadModule();
      asUnauthenticated();

      const result = await bootstrapAdmin();
      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("promotes user to ADMIN when no admins exist", async () => {
      const { bootstrapAdmin } = await loadModule();
      asDeveloper();
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<boolean>) => {
        return fn({
          user: {
            count: vi.fn().mockResolvedValue(0),
            update: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await bootstrapAdmin();

      expect(result).toEqual({ success: true, data: undefined });
    });

    it("rejects when admin already exists", async () => {
      const { bootstrapAdmin } = await loadModule();
      asDeveloper();
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<boolean>) => {
        return fn({
          user: {
            count: vi.fn().mockResolvedValue(1),
            update: vi.fn(),
          },
        });
      });

      const result = await bootstrapAdmin();

      expect(result).toEqual({
        success: false,
        error: "An admin already exists. Contact them for role changes.",
      });
    });
  });

  // ── getAdminCount ──────────────────────────────────────────────────

  describe("getAdminCount", () => {
    it("returns admin count", async () => {
      const { getAdminCount } = await loadModule();
      mockPrisma.user.count.mockResolvedValue(2);

      const result = await getAdminCount();
      expect(result).toBe(2);
      expect(mockPrisma.user.count).toHaveBeenCalledWith({ where: { role: "ADMIN" } });
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

    it("deletes another user in a transaction", async () => {
      const { deleteUser } = await loadModule();
      asAdmin();
      mockPrisma.$transaction.mockResolvedValue(undefined);

      const result = await deleteUser("other-user");

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      const txArg = mockPrisma.$transaction.mock.calls[0][0];
      expect(txArg).toHaveLength(6);
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
