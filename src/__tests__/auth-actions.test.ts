import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks -----------------------------------------------------------

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  invitation: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockSignIn = vi.fn();
vi.mock("@/lib/auth", () => ({ signIn: mockSignIn }));

vi.mock("@/lib/validations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/validations")>("@/lib/validations");
  return actual;
});

// --- Helpers ----------------------------------------------------------

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.append(k, v);
  return fd;
}

function isRedirect(error: unknown): error is Error & { digest: string } {
  return (
    error instanceof Error &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

// --- Tests ------------------------------------------------------------

describe("auth-actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // Lazy-import so mocks are wired first
  async function loadModule() {
    return import("@/services/auth-actions");
  }

  // ── login ──────────────────────────────────────────────────────────

  describe("login", () => {
    it("returns error on invalid credentials", async () => {
      const { login } = await loadModule();
      mockSignIn.mockRejectedValue(new Error("CredentialsSignin"));

      const fd = makeFormData({ email: "bad@test.com", password: "wrong" });
      const result = await login(null, fd);

      expect(result).toEqual({ success: false, error: "Invalid email or password" });
    });

    it("re-throws NEXT_REDIRECT from signIn", async () => {
      const { login } = await loadModule();
      const redirectErr = new Error("NEXT_REDIRECT") as Error & { digest: string };
      redirectErr.digest = "NEXT_REDIRECT;/dashboard";
      mockSignIn.mockRejectedValue(redirectErr);

      const fd = makeFormData({ email: "user@test.com", password: "password123" });
      await expect(login(null, fd)).rejects.toThrow("NEXT_REDIRECT");
    });

    it("redirects to /dashboard on success", async () => {
      const { login } = await loadModule();
      mockSignIn.mockResolvedValue(undefined);

      const fd = makeFormData({ email: "user@test.com", password: "password123" });
      try {
        await login(null, fd);
        expect.fail("Expected redirect to throw");
      } catch (e) {
        expect(isRedirect(e)).toBe(true);
        expect((e as { digest: string }).digest).toContain("/dashboard");
      }
    });
  });

  // ── register ───────────────────────────────────────────────────────

  describe("register", () => {
    it("rejects invalid input (short name)", async () => {
      const { register } = await loadModule();

      const fd = makeFormData({ name: "A", email: "a@b.com", password: "password123" });
      const result = await register(null, fd);

      expect(result.success).toBe(false);
      expect((result as { error: string }).error).toMatch(/name/i);
    });

    it("rejects invalid input (short password)", async () => {
      const { register } = await loadModule();

      const fd = makeFormData({ name: "Alice", email: "a@b.com", password: "12345" });
      const result = await register(null, fd);

      expect(result.success).toBe(false);
      expect((result as { error: string }).error).toMatch(/password/i);
    });

    it("rejects invalid input (bad email)", async () => {
      const { register } = await loadModule();

      const fd = makeFormData({ name: "Alice", email: "not-an-email", password: "password123" });
      const result = await register(null, fd);

      expect(result.success).toBe(false);
      expect((result as { error: string }).error).toMatch(/email/i);
    });

    it("rejects duplicate email", async () => {
      const { register } = await loadModule();
      mockPrisma.user.findUnique.mockResolvedValue({ id: "existing" });

      const fd = makeFormData({ name: "Alice", email: "taken@test.com", password: "password123" });
      const result = await register(null, fd);

      expect(result).toEqual({ success: false, error: "Email already registered" });
    });

    it("first user becomes ADMIN and redirects", async () => {
      const { register } = await loadModule();
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.user.create.mockResolvedValue({ id: "u1" });

      const fd = makeFormData({ name: "Alice Admin", email: "alice@test.com", password: "password123" });
      try {
        await register(null, fd);
        expect.fail("Expected redirect");
      } catch (e) {
        expect(isRedirect(e)).toBe(true);
      }

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ role: "ADMIN" }),
      });
    });

    it("subsequent user without token is rejected", async () => {
      const { register } = await loadModule();
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.count.mockResolvedValue(1);

      const fd = makeFormData({ name: "Bob", email: "bob@test.com", password: "password123" });
      const result = await register(null, fd);

      expect(result).toEqual({
        success: false,
        error: "Registration requires an invitation. Contact your admin.",
      });
    });

    it("rejects expired invite token", async () => {
      const { register } = await loadModule();
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.invitation.findUnique.mockResolvedValue({
        email: "bob@test.com",
        role: "DEVELOPER",
        usedAt: null,
        expiresAt: new Date("2020-01-01"),
      });

      const fd = makeFormData({ name: "Bob", email: "bob@test.com", password: "password123", token: "abc123" });
      const result = await register(null, fd);

      expect(result).toEqual({ success: false, error: "Invalid or expired invitation link" });
    });

    it("rejects already-used invite token", async () => {
      const { register } = await loadModule();
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.invitation.findUnique.mockResolvedValue({
        email: "bob@test.com",
        role: "DEVELOPER",
        usedAt: new Date(),
        expiresAt: new Date("2099-01-01"),
      });

      const fd = makeFormData({ name: "Bob", email: "bob@test.com", password: "password123", token: "abc123" });
      const result = await register(null, fd);

      expect(result).toEqual({ success: false, error: "Invalid or expired invitation link" });
    });

    it("rejects token sent to a different email", async () => {
      const { register } = await loadModule();
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.invitation.findUnique.mockResolvedValue({
        email: "someone-else@test.com",
        role: "DEVELOPER",
        usedAt: null,
        expiresAt: new Date("2099-01-01"),
      });

      const fd = makeFormData({ name: "Bob", email: "bob@test.com", password: "password123", token: "abc123" });
      const result = await register(null, fd);

      expect(result).toEqual({
        success: false,
        error: "This invitation was sent to a different email address",
      });
    });

    it("registers with valid invite token, assigns invited role, marks token used", async () => {
      const { register } = await loadModule();
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.invitation.findUnique.mockResolvedValue({
        email: "bob@test.com",
        role: "TESTER",
        usedAt: null,
        expiresAt: new Date("2099-01-01"),
      });
      mockPrisma.user.create.mockResolvedValue({ id: "u2" });
      mockPrisma.invitation.update.mockResolvedValue({});

      const fd = makeFormData({ name: "Bob", email: "bob@test.com", password: "password123", token: "valid-token" });
      try {
        await register(null, fd);
        expect.fail("Expected redirect");
      } catch (e) {
        expect(isRedirect(e)).toBe(true);
      }

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ role: "TESTER", email: "bob@test.com" }),
      });
      expect(mockPrisma.invitation.update).toHaveBeenCalledWith({
        where: { token: "valid-token" },
        data: { usedAt: expect.any(Date) },
      });
    });
  });

  // ── getSystemHasUsers ──────────────────────────────────────────────

  describe("getSystemHasUsers", () => {
    it("returns false when no users exist", async () => {
      const { getSystemHasUsers } = await loadModule();
      mockPrisma.user.count.mockResolvedValue(0);

      expect(await getSystemHasUsers()).toBe(false);
    });

    it("returns true when users exist", async () => {
      const { getSystemHasUsers } = await loadModule();
      mockPrisma.user.count.mockResolvedValue(3);

      expect(await getSystemHasUsers()).toBe(true);
    });
  });
});
