"use client";

import { useState, useTransition, useRef } from "react";
import { uploadAttachment, deleteAttachment } from "@/services/attachment-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Paperclip,
  Upload,
  Trash2,
  FileText,
  Image,
  File,
  Download,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";

type Attachment = {
  id: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  createdAt: Date;
  uploadedBy: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.includes("pdf") || mimeType.includes("text")) return FileText;
  return File;
}

export function TaskAttachments({
  taskId,
  attachments,
  currentUserId,
  currentUserRole,
}: {
  taskId: string;
  attachments: Attachment[];
  currentUserId: string;
  currentUserRole: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const result = await uploadAttachment(taskId, formData);
      if (!result.success) {
        setError(result.error ?? "Upload failed");
      }
      router.refresh();
    });

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDelete(id: string, filename: string) {
    if (!confirm(`Delete "${filename}"?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteAttachment(id);
      if (!result.success) setError(result.error ?? "Delete failed");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Paperclip className="h-4.5 w-4.5 text-zinc-400" strokeWidth={1.75} />
            <h2 className="font-semibold text-zinc-900 text-[15px]">
              Attachments
              {attachments.length > 0 && (
                <span className="ml-1.5 text-xs font-normal text-zinc-400">
                  ({attachments.length})
                </span>
              )}
            </h2>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleUpload}
              className="hidden"
              accept="*/*"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              loading={isPending}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload
            </Button>
          </div>
        </div>
        {error && (
          <p className="text-xs text-red-600 mt-2 bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}
      </CardHeader>

      <CardContent>
        {attachments.length === 0 ? (
          <div className="text-center py-6">
            <Paperclip className="h-8 w-8 text-zinc-200 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm text-zinc-400">No attachments</p>
            <p className="text-xs text-zinc-300 mt-0.5">
              Upload files up to 25MB
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {attachments.map((a) => {
              const FileIcon = getFileIcon(a.mimeType);
              const canDelete =
                a.uploadedBy === currentUserId ||
                ["ADMIN", "PROJECT_MANAGER"].includes(currentUserRole);

              return (
                <li
                  key={a.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 transition-colors group"
                >
                  <div className="h-9 w-9 rounded-lg bg-zinc-100 flex items-center justify-center flex-shrink-0">
                    <FileIcon className="h-4.5 w-4.5 text-zinc-500" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">
                      {a.filename}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {formatSize(a.fileSize)} &middot;{" "}
                      {formatDistanceToNow(new Date(a.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={`/api/attachments/${a.id}`}
                      download={a.filename}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      aria-label={`Download ${a.filename}`}
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(a.id, a.filename)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        aria-label={`Delete ${a.filename}`}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
