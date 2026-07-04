import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const projectSchema = z.object({
  name: z.string().min(2, "Project name is required"),
  key: z
    .string()
    .min(2)
    .max(6)
    .toUpperCase()
    .regex(/^[A-Z]+$/, "Key must be uppercase letters only"),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  type: z.enum(["FEATURE", "BUG", "IMPROVEMENT", "TASK"]).optional(),
  assigneeId: z.string().optional().nullable(),
  sprintId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  projectId: z.string(),
});

export const sprintSchema = z.object({
  name: z.string().min(1, "Sprint name is required"),
  goal: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  projectId: z.string(),
});

export const commentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty"),
  taskId: z.string(),
});
