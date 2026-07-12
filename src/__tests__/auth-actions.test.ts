import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks -----------------------------------------------------------

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  workspace: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  workspaceMember: {
    create: vi.fn(),
  },
  $transaction: vi.fn(async (fn) => {
    // The action wraps user/workspace/member creation in a $transaction callback.
    return fn(mockPrisma);
  }),
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
    // The $transaction mock re-wires each reset — restore its behavior.
    mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma));
  });

  async function loadModule() {
    return import("@/services/auth-actions");
  }

  // ── login ──────────────────────────────────────────────────────────

  describe("login", () => {
    it("returns error on invalid credentials", async () => {
      const { login } = await loadModule();
      mockSignIn.mockRejectedValue(new Error("CredentialsSignin"));

      const result = await login(null, makeFormData({ email: "u@x.com", password: "bad" }));
      expect(result).toEqual({ success: false, error: "Invalid email or password" });
    });

    it("redirects to / (root resolves default workspace) on success", async () => {
      const { login } = await loadModule();
      mockSignIn.mockResolvedValue(undefined);

      try {
        await login(null, makeFormData({ email: "u@x.com", password: "ok" }));
        expect.fail("expected redirect");
      } catch (err) {
        expect(isRedirect(err)).toBe(true);
        if (isRedirect(err)) expect(err.digest).toContain("/");
      }
    });
  });

  // ── register ───────────────────────────────────────────────────────

  describe("register", () => {
    it("rejects when email already registered", async () => {
      const { register } = await loadModule();
      mockPrisma.user.findUnique.mockResolvedValue({ id: "u1" });

      const result = await register(
        null,
        makeFormData({ name: "Alice", email: "taken@x.com", password: "password123" })
      );
      expect(result).toEqual({ success: false, error: "Email already registered" });
    });

    it("rejects on invalid input from Zod", async () => {
      const { register } = await loadModule();
      const result = await register(
        null,
        makeFormData({ name: "A", email: "not-email", password: "short" })
      );
      expect(result.success).toBe(false);
    });

    it("creates user + workspace + ADMIN membership atomically, then redirects", async () => {
      const { register } = await loadModule();
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.workspace.findUnique.mockResolvedValue(null); // slug is free
      mockPrisma.user.create.mockResolvedValue({ id: "new-user" });
      mockPrisma.workspace.create.mockResolvedValue({ id: "w1", slug: "alices-workspace" });
      mockPrisma.workspaceMember.create.mockResolvedValue({});

      try {
        await register(
          null,
          makeFormData({ name: "Alice Smith", email: "a@x.com", password: "password123" })
        );
        expect.fail("expected redirect");
      } catch (err) {
        expect(isRedirect(err)).toBe(true);
        if (isRedirect(err)) expect(err.digest).toContain("/login?registered=true");
      }

      expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Alice Smith",
          email: "a@x.com",
          passwordHash: expect.any(String),
        }),
      });
      expect(mockPrisma.workspace.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Alice's Workspace",
          slug: expect.stringMatching(/^alices?-workspace/),
          createdById: "new-user",
        }),
      });
      expect(mockPrisma.workspaceMember.create).toHaveBeenCalledWith({
        data: {
          userId: "new-user",
          workspaceId: "w1",
          role: "ADMIN",
        },
      });
    });

    it("dedupes slug with -2 suffix on unique conflict", async () => {
      const { register } = await loadModule();
      mockPrisma.user.findUnique.mockResolvedValue(null);
      // First slug taken, second free.
      mockPrisma.workspace.findUnique
        .mockResolvedValueOnce({ id: "existing" })
        .mockResolvedValueOnce(null);
      mockPrisma.user.create.mockResolvedValue({ id: "u2" });
      mockPrisma.workspace.create.mockResolvedValue({ id: "w2", slug: "bob-workspace-2" });
      mockPrisma.workspaceMember.create.mockResolvedValue({});

      try {
        await register(
          null,
          makeFormData({ name: "Bob", email: "b@x.com", password: "password123" })
        );
      } catch (err) {
        expect(isRedirect(err)).toBe(true);
      }

      const slug = mockPrisma.workspace.create.mock.calls[0][0].data.slug;
      expect(slug).toBe("bobs-workspace-2");
    });
  });
});
