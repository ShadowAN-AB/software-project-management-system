import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks -----------------------------------------------------------

const mockSession = {
  user: { id: "user-1", name: "Dev", email: "dev@test.com", role: "DEVELOPER" as const },
};

const mockRequireAuth = vi.fn();
const mockRequireProjectMember = vi.fn();
vi.mock("@/lib/authorization", () => ({
  requireAuth: mockRequireAuth,
  requireProjectMember: mockRequireProjectMember,
  getTaskProjectId: vi.fn(),
  getSprintProjectId: vi.fn(),
}));

const mockPrisma = {
  task: { findMany: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };
const mockIsAIEnabled = vi.fn(() => true);
const mockCheckRateLimit = vi.fn<() => RateLimitResult>(() => ({ ok: true }));
const mockGenerateJSON = vi.fn();
const mockGenerateText = vi.fn();
vi.mock("@/lib/ai", () => ({
  isAIEnabled: mockIsAIEnabled,
  checkAIRateLimit: mockCheckRateLimit,
  generateJSON: mockGenerateJSON,
  generateText: mockGenerateText,
  aiErrorMessage: (e: string) => `err:${e}`,
}));

// --- Helpers ---------------------------------------------------------

async function loadModule() {
  return import("@/services/ai-actions");
}

function asAuthed() {
  mockRequireAuth.mockResolvedValue(mockSession);
}

function llmReturns(filter: unknown) {
  mockGenerateJSON.mockResolvedValue({ ok: true, value: filter });
}

// --- Tests -----------------------------------------------------------

describe("searchMyTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAIEnabled.mockReturnValue(true);
    mockCheckRateLimit.mockReturnValue({ ok: true });
    mockPrisma.task.findMany.mockResolvedValue([]);
  });

  // ── auth + input guards ─────────────────────────────────────────

  it("returns Unauthorized when there is no session", async () => {
    const { searchMyTasks } = await loadModule();
    mockRequireAuth.mockResolvedValue(null);

    const result = await searchMyTasks("anything");
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(mockGenerateJSON).not.toHaveBeenCalled();
  });

  it("rejects queries shorter than 2 chars", async () => {
    const { searchMyTasks } = await loadModule();
    asAuthed();

    expect(await searchMyTasks("a")).toEqual({ success: false, error: "Query too short" });
    expect(await searchMyTasks("   ")).toEqual({ success: false, error: "Query too short" });
  });

  it("rejects queries longer than 300 chars", async () => {
    const { searchMyTasks } = await loadModule();
    asAuthed();
    const result = await searchMyTasks("x".repeat(301));
    expect(result).toEqual({ success: false, error: "Query too long" });
  });

  it("returns AI not configured when isAIEnabled is false", async () => {
    const { searchMyTasks } = await loadModule();
    asAuthed();
    mockIsAIEnabled.mockReturnValue(false);
    expect(await searchMyTasks("bugs")).toEqual({
      success: false,
      error: "AI is not configured",
    });
  });

  it("surfaces rate-limit blocks with a retry hint", async () => {
    const { searchMyTasks } = await loadModule();
    asAuthed();
    mockCheckRateLimit.mockReturnValue({ ok: false, retryAfterSec: 42 });
    const result = await searchMyTasks("bugs");
    expect(result).toEqual({
      success: false,
      error: "AI rate limit reached — try again in 42s.",
    });
    expect(mockGenerateJSON).not.toHaveBeenCalled();
  });

  it("surfaces upstream AI errors via aiErrorMessage", async () => {
    const { searchMyTasks } = await loadModule();
    asAuthed();
    mockGenerateJSON.mockResolvedValue({ ok: false, error: "bad_json" });
    const result = await searchMyTasks("bugs");
    expect(result).toEqual({ success: false, error: "err:bad_json" });
  });

  // ── enum whitelisting (the security-critical bit) ───────────────

  it("filters out invalid status enum values", async () => {
    const { searchMyTasks } = await loadModule();
    asAuthed();
    llmReturns({ status: ["TODO", "DROP TABLE tasks", "IN_PROGRESS", "MAYBE"] });

    const result = await searchMyTasks("in progress");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.filter.status).toEqual(["TODO", "IN_PROGRESS"]);
    }
    const where = mockPrisma.task.findMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ["TODO", "IN_PROGRESS"] });
  });

  it("filters out invalid priority + type values and drops empty arrays", async () => {
    const { searchMyTasks } = await loadModule();
    asAuthed();
    llmReturns({
      priority: ["HIGH", "URGENT"],
      type: ["INVALID_ONLY"],
    });

    const result = await searchMyTasks("high priority");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.filter.priority).toEqual(["HIGH"]);
      expect(result.data.filter.type).toBeUndefined();
    }
    const where = mockPrisma.task.findMany.mock.calls[0][0].where;
    expect(where.priority).toEqual({ in: ["HIGH"] });
    expect(where.type).toBeUndefined();
  });

  it("ignores non-boolean overdue and non-numeric dueWithinDays", async () => {
    const { searchMyTasks } = await loadModule();
    asAuthed();
    llmReturns({
      overdue: "yes",
      dueWithinDays: "seven",
    });

    const result = await searchMyTasks("late tasks");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.filter.overdue).toBeUndefined();
      expect(result.data.filter.dueWithinDays).toBeUndefined();
    }
    const where = mockPrisma.task.findMany.mock.calls[0][0].where;
    expect(where.dueDate).toBeUndefined();
    expect(where.OR).toBeUndefined();
  });

  it("caps dueWithinDays at 60 and floors non-integers", async () => {
    const { searchMyTasks } = await loadModule();
    asAuthed();
    llmReturns({ dueWithinDays: 500.7 });

    const result = await searchMyTasks("due soon");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.filter.dueWithinDays).toBe(60);
    }
  });

  it("rejects negative or zero dueWithinDays", async () => {
    const { searchMyTasks } = await loadModule();
    asAuthed();
    llmReturns({ dueWithinDays: -3 });

    const result = await searchMyTasks("due");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.filter.dueWithinDays).toBeUndefined();
    }
  });

  it("only keeps titleContains between 2 and 100 chars", async () => {
    const { searchMyTasks } = await loadModule();
    asAuthed();

    llmReturns({ titleContains: "a" });
    let result = await searchMyTasks("something");
    if (result.success) expect(result.data.filter.titleContains).toBeUndefined();

    vi.clearAllMocks();
    mockPrisma.task.findMany.mockResolvedValue([]);
    llmReturns({ titleContains: "auth" });
    result = await searchMyTasks("something");
    if (result.success) expect(result.data.filter.titleContains).toBe("auth");

    vi.clearAllMocks();
    mockPrisma.task.findMany.mockResolvedValue([]);
    llmReturns({ titleContains: "x".repeat(101) });
    result = await searchMyTasks("something");
    if (result.success) expect(result.data.filter.titleContains).toBeUndefined();
  });

  // ── due-date where-clause assembly ──────────────────────────────

  it("overdue only: dueDate < now and status defaults to not DONE", async () => {
    const { searchMyTasks } = await loadModule();
    asAuthed();
    llmReturns({ overdue: true });

    await searchMyTasks("overdue tasks");
    const where = mockPrisma.task.findMany.mock.calls[0][0].where;
    expect(where.dueDate).toEqual({ lt: expect.any(Date) });
    expect(where.status).toEqual({ not: "DONE" });
    expect(where.OR).toBeUndefined();
  });

  it("dueWithinDays only: dueDate in [now, now+Nd]", async () => {
    const { searchMyTasks } = await loadModule();
    asAuthed();
    llmReturns({ dueWithinDays: 7 });

    await searchMyTasks("this week");
    const where = mockPrisma.task.findMany.mock.calls[0][0].where;
    expect(where.dueDate.gte).toBeInstanceOf(Date);
    expect(where.dueDate.lte).toBeInstanceOf(Date);
    expect(where.dueDate.lte.getTime() - where.dueDate.gte.getTime()).toBe(7 * 86_400_000);
    expect(where.OR).toBeUndefined();
  });

  it("overdue + dueWithinDays: builds an OR (bug #1 regression guard)", async () => {
    const { searchMyTasks } = await loadModule();
    asAuthed();
    llmReturns({ overdue: true, dueWithinDays: 5 });

    await searchMyTasks("overdue or due soon");
    const where = mockPrisma.task.findMany.mock.calls[0][0].where;

    expect(where.OR).toHaveLength(2);
    expect(where.OR[0]).toEqual({ dueDate: { lt: expect.any(Date) } });
    expect(where.OR[1].dueDate.gte).toBeInstanceOf(Date);
    expect(where.OR[1].dueDate.lte).toBeInstanceOf(Date);
    // status still guarded when no explicit status came from LLM
    expect(where.status).toEqual({ not: "DONE" });
    // the top-level dueDate should NOT be set — everything went into OR
    expect(where.dueDate).toBeUndefined();
  });

  it("overdue with explicit status leaves the status filter intact", async () => {
    const { searchMyTasks } = await loadModule();
    asAuthed();
    llmReturns({ overdue: true, status: ["DONE"] });

    await searchMyTasks("overdue but finished");
    const where = mockPrisma.task.findMany.mock.calls[0][0].where;
    // status was set from the enum whitelist, not overwritten by the overdue guard
    expect(where.status).toEqual({ in: ["DONE"] });
    expect(where.dueDate).toEqual({ lt: expect.any(Date) });
  });

  // ── query scoping ───────────────────────────────────────────────

  it("always scopes tasks to assigneeId = session.user.id", async () => {
    const { searchMyTasks } = await loadModule();
    asAuthed();
    llmReturns({});

    await searchMyTasks("anything");
    const where = mockPrisma.task.findMany.mock.calls[0][0].where;
    expect(where.assigneeId).toBe("user-1");
  });
});
