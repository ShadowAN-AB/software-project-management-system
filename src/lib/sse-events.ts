import type { TaskStatus, SprintStatus, NotificationType } from "@prisma/client";

export type SSEEvent =
  | {
      type: "task:created";
      task: {
        id: string;
        title: string;
        status: TaskStatus;
        priority: string;
        type: string;
        dueDate: string | null;
        assignee: { id: string; name: string } | null;
        labels: { id: string; label: { id: string; name: string; color: string } }[];
        _count: { comments: number };
      };
    }
  | {
      type: "task:statusChanged";
      taskId: string;
      status: TaskStatus;
      previousStatus: TaskStatus;
    }
  | {
      type: "task:updated";
      taskId: string;
      changes: Record<string, unknown>;
    }
  | {
      type: "task:deleted";
      taskId: string;
    }
  | {
      type: "comment:added";
      taskId: string;
      comment: {
        id: string;
        content: string;
        createdAt: string;
        user: { id: string; name: string; email: string };
      };
    }
  | {
      type: "notification:created";
      notification: {
        id: string;
        type: NotificationType;
        title: string;
        message: string;
        read: boolean;
        link: string | null;
        createdAt: string;
      };
    }
  | {
      type: "sprint:statusChanged";
      sprintId: string;
      status: SprintStatus;
      projectId: string;
    };

export type SSEFrame = SSEEvent & { _actorId: string };
