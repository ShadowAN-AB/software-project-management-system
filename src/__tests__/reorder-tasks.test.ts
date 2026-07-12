import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks -----------------------------------------------------------

const mockSession = {
  user: { id: "user-1", name: "Dev", email: "dev@test.com", role: "DEVELOPER" as const },
};

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const mockPrisma = {
  task: {
    findMany: vi.fn(),
    update: vi.fn((args: unknown) => ({ __update: args })),
  },
  $transaction: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockRequireProjectMember = vi.fn();
const mockResolveDefaultWorkspace = vi.fn(() =>
  Promise.resolve({ workspaceId: "w1", workspaceSlug: "acme", role: "DEVELOPER" as const })
);
vi.mock("@/lib/authorization", () => ({
  requireProjectMember: mockRequireProjectMember,
  getTaskProjectId: vi.fn(),
  resolveDefaultWorkspace: mockResolveDefaultWorkspace,
}));

const mockEmit = vi.fn();
vi.mock("@/lib/event-bus", () => ({ eventBus: { emit: mockEmit } }));

vi.mock("@/lib/email", () => ({
  sendTaskAssignedEmail: vi.fn(),
  sendTaskStatusEmail: vi.fn(),
  sendCommentEmail: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({ removeAttachmentObjects: vi.fn() }));

vi.mock("@/services/notification-actions", () => ({ createNotification: vi.fn() }));

// --- Helpers ---------------------------------------------------------

async function loadModule() {
  return import("@/services/task-actions");
}

function asAuthenticatedMember() {
  mockAuth.mockResolvedValue(mockSession);
  mockRequireProjectMember.mockResolvedValue(true);
}

// --- Tests -----------------------------------------------------------

describe("reorderTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated callers", async () => {
    const { reorderTasks } = await loadModule();
    mockAuth.mockResolvedValue(null);

    const result = await reorderTasks("project-1", "TODO", ["t1"]);

    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects non-members", async () => {
    const { reorderTasks } = await loadModule();
    mockAuth.mockResolvedValue(mockSession);
    mockRequireProjectMember.mockResolvedValue(false);

    const result = await reorderTasks("project-1", "TODO", ["t1"]);

    expect(result).toEqual({ success: false, error: "Not a member of this project" });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("no-ops on empty orderedIds without touching the DB", async () => {
    const { reorderTasks } = await loadModule();
    asAuthenticatedMember();

    const result = await reorderTasks("project-1", "TODO", []);

    expect(result).toEqual({ success: true, data: undefined });
    expect(mockPrisma.task.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("rejects payloads over 500 tasks", async () => {
    const { reorderTasks } = await loadModule();
    asAuthenticatedMember();
    const ids = Array.from({ length: 501 }, (_, i) => `t${i}`);

    const result = await reorderTasks("project-1", "TODO", ids);

    expect(result).toEqual({ success: false, error: "Too many tasks" });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects duplicate ids", async () => {
    const { reorderTasks } = await loadModule();
    asAuthenticatedMember();

    const result = await reorderTasks("project-1", "TODO", ["t1", "t2", "t1"]);

    expect(result).toEqual({ success: false, error: "Duplicate task ids" });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects when any id does not belong to the project", async () => {
    const { reorderTasks } = await loadModule();
    asAuthenticatedMember();
    mockPrisma.task.findMany.mockResolvedValue([{ id: "t1" }, { id: "t2" }]);

    const result = await reorderTasks("project-1", "TODO", ["t1", "t2", "t3"]);

    expect(result).toEqual({
      success: false,
      error: "Task ids do not all belong to this project",
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("writes order + status in a single transaction and emits task:reordered", async () => {
    const { reorderTasks } = await loadModule();
    asAuthenticatedMember();
    mockPrisma.task.findMany.mockResolvedValue([
      { id: "t1" }, { id: "t2" }, { id: "t3" },
    ]);
    mockPrisma.$transaction.mockResolvedValue([]);

    const result = await reorderTasks("project-1", "IN_PROGRESS", ["t3", "t1", "t2"]);

    expect(result).toEqual({ success: true, data: undefined });

    expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["t3", "t1", "t2"] }, projectId: "project-1" },
      select: { id: true },
    });

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    const updates = mockPrisma.$transaction.mock.calls[0][0] as Array<{ __update: unknown }>;
    expect(updates).toHaveLength(3);
    expect(updates[0].__update).toEqual({
      where: { id: "t3" },
      data: { order: 0, status: "IN_PROGRESS" },
    });
    expect(updates[1].__update).toEqual({
      where: { id: "t1" },
      data: { order: 1, status: "IN_PROGRESS" },
    });
    expect(updates[2].__update).toEqual({
      where: { id: "t2" },
      data: { order: 2, status: "IN_PROGRESS" },
    });

    expect(mockEmit).toHaveBeenCalledWith("project:project-1", {
      type: "task:reordered",
      _actorId: "user-1",
      projectId: "project-1",
      status: "IN_PROGRESS",
      orderedIds: ["t3", "t1", "t2"],
    });
  });
});
