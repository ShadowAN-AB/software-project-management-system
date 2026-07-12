"use client";

import { useActionState, useState } from "react";
import { addComment } from "@/services/task-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useEventStream } from "@/hooks/use-event-stream";
import type { SSEFrame } from "@/lib/sse-events";
import { Avatar } from "@/components/ui/avatar";
import { Markdown } from "@/components/ui/markdown";

type Comment = {
  id: string;
  content: string;
  createdAt: Date;
  user: { id: string; name: string; email: string };
};


export function CommentThread({
  taskId,
  comments: initialComments,
  currentUserName,
  currentUserId,
}: {
  taskId: string;
  comments: Comment[];
  currentUserName: string;
  currentUserId: string;
}) {
  const [state, formAction, isPending] = useActionState(addComment, null);
  const [localComments, setLocalComments] = useState(initialComments);
  const [lastInitial, setLastInitial] = useState(initialComments);
  if (lastInitial !== initialComments) {
    setLastInitial(initialComments);
    setLocalComments(initialComments);
  }

  useEventStream({
    channels: [`task:${taskId}`],
    currentUserId,
    handlers: {
      "comment:added": (event: SSEFrame) => {
        if (event.type !== "comment:added") return;
        const c = event.comment;
        setLocalComments((prev) => {
          if (prev.some((existing) => existing.id === c.id)) return prev;
          return [{ ...c, createdAt: new Date(c.createdAt) }, ...prev];
        });
      },
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4.5 w-4.5 text-zinc-400" strokeWidth={1.75} />
          <h2 className="font-semibold text-zinc-900 text-[15px]">
            Comments
            {localComments.length > 0 && (
              <span className="ml-1.5 text-xs font-normal text-zinc-400">
                ({localComments.length})
              </span>
            )}
          </h2>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Add Comment Form */}
        <form action={formAction} className="flex gap-3">
          <input type="hidden" name="taskId" value={taskId} />
          <Avatar name={currentUserName} size="md" className="mt-0.5" />
          <div className="flex-1 flex gap-2">
            <input
              name="content"
              placeholder="Write a comment..."
              className="flex-1 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              autoComplete="off"
            />
            <Button type="submit" size="sm" loading={isPending}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </form>

        {state && !state.success && (
          <p className="text-xs text-red-600 ml-11">{state.error}</p>
        )}

        {/* Comments List */}
        {localComments.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-8 w-8 text-zinc-200 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm text-zinc-400">No comments yet</p>
            <p className="text-xs text-zinc-300 mt-0.5">
              Be the first to comment
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {localComments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar name={comment.user.name} size="md" className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {comment.user.name}
                    </span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {formatDistanceToNow(new Date(comment.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <div className="text-sm mt-0.5">
                    <Markdown>{comment.content}</Markdown>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
