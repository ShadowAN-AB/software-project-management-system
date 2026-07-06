export type ProjectTemplate = {
  id: string;
  name: string;
  description: string;
  labels: { name: string; color: string }[];
  tasks: {
    title: string;
    description?: string;
    status: "BACKLOG" | "TODO";
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    type: "FEATURE" | "BUG" | "IMPROVEMENT" | "TASK";
  }[];
};

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "scrum",
    name: "Scrum Project",
    description: "Sprint-based agile workflow with user stories and backlog",
    labels: [
      { name: "frontend", color: "#3b82f6" },
      { name: "backend", color: "#22c55e" },
      { name: "design", color: "#a855f7" },
      { name: "devops", color: "#f97316" },
      { name: "documentation", color: "#64748b" },
    ],
    tasks: [
      { title: "Set up project repository and CI/CD", status: "TODO", priority: "HIGH", type: "TASK" },
      { title: "Define product requirements document", status: "TODO", priority: "HIGH", type: "TASK" },
      { title: "Design system architecture", status: "BACKLOG", priority: "HIGH", type: "TASK" },
      { title: "Create database schema", status: "BACKLOG", priority: "MEDIUM", type: "TASK" },
      { title: "Implement user authentication", status: "BACKLOG", priority: "HIGH", type: "FEATURE" },
      { title: "Build core API endpoints", status: "BACKLOG", priority: "MEDIUM", type: "FEATURE" },
      { title: "Design UI mockups", status: "BACKLOG", priority: "MEDIUM", type: "TASK" },
      { title: "Set up testing framework", status: "BACKLOG", priority: "MEDIUM", type: "TASK" },
      { title: "Write unit tests for core modules", status: "BACKLOG", priority: "LOW", type: "TASK" },
      { title: "Deploy to staging environment", status: "BACKLOG", priority: "LOW", type: "TASK" },
    ],
  },
  {
    id: "bug-tracking",
    name: "Bug Tracking",
    description: "Track and triage bugs with severity-based labels",
    labels: [
      { name: "critical", color: "#ef4444" },
      { name: "major", color: "#f97316" },
      { name: "minor", color: "#eab308" },
      { name: "cosmetic", color: "#6366f1" },
      { name: "regression", color: "#dc2626" },
      { name: "needs-repro", color: "#64748b" },
    ],
    tasks: [
      { title: "Set up bug report template", status: "TODO", priority: "HIGH", type: "TASK" },
      { title: "Define severity classification criteria", status: "TODO", priority: "HIGH", type: "TASK" },
      { title: "Create triage process documentation", status: "BACKLOG", priority: "MEDIUM", type: "TASK" },
      { title: "Set up error monitoring integration", status: "BACKLOG", priority: "HIGH", type: "TASK" },
      { title: "Review and triage existing bug reports", status: "BACKLOG", priority: "MEDIUM", type: "TASK" },
    ],
  },
  {
    id: "product-launch",
    name: "Product Launch",
    description: "End-to-end checklist for launching a new product",
    labels: [
      { name: "marketing", color: "#ec4899" },
      { name: "engineering", color: "#3b82f6" },
      { name: "design", color: "#a855f7" },
      { name: "legal", color: "#64748b" },
      { name: "content", color: "#14b8a6" },
    ],
    tasks: [
      { title: "Finalize feature scope for launch", status: "TODO", priority: "CRITICAL", type: "TASK" },
      { title: "Complete landing page design", status: "TODO", priority: "HIGH", type: "FEATURE" },
      { title: "Write launch announcement blog post", status: "BACKLOG", priority: "MEDIUM", type: "TASK" },
      { title: "Prepare press kit and media assets", status: "BACKLOG", priority: "MEDIUM", type: "TASK" },
      { title: "Set up analytics and tracking", status: "BACKLOG", priority: "HIGH", type: "TASK" },
      { title: "Run load testing on infrastructure", status: "BACKLOG", priority: "HIGH", type: "TASK" },
      { title: "Create onboarding flow for new users", status: "BACKLOG", priority: "HIGH", type: "FEATURE" },
      { title: "Draft terms of service and privacy policy", status: "BACKLOG", priority: "HIGH", type: "TASK" },
      { title: "Plan social media campaign", status: "BACKLOG", priority: "MEDIUM", type: "TASK" },
      { title: "Set up customer support channels", status: "BACKLOG", priority: "MEDIUM", type: "TASK" },
      { title: "Schedule launch date and send invites", status: "BACKLOG", priority: "LOW", type: "TASK" },
      { title: "Post-launch monitoring plan", status: "BACKLOG", priority: "MEDIUM", type: "TASK" },
    ],
  },
  {
    id: "website-redesign",
    name: "Website Redesign",
    description: "Redesign project with design, development, and content phases",
    labels: [
      { name: "design", color: "#a855f7" },
      { name: "frontend", color: "#3b82f6" },
      { name: "content", color: "#14b8a6" },
      { name: "SEO", color: "#f97316" },
      { name: "accessibility", color: "#22c55e" },
    ],
    tasks: [
      { title: "Audit current website performance and UX", status: "TODO", priority: "HIGH", type: "TASK" },
      { title: "Define sitemap and information architecture", status: "TODO", priority: "HIGH", type: "TASK" },
      { title: "Create wireframes for key pages", status: "BACKLOG", priority: "HIGH", type: "TASK" },
      { title: "Design visual style guide and components", status: "BACKLOG", priority: "HIGH", type: "TASK" },
      { title: "Build responsive page templates", status: "BACKLOG", priority: "MEDIUM", type: "FEATURE" },
      { title: "Migrate and update existing content", status: "BACKLOG", priority: "MEDIUM", type: "TASK" },
      { title: "Implement SEO best practices", status: "BACKLOG", priority: "MEDIUM", type: "IMPROVEMENT" },
      { title: "Accessibility audit and fixes", status: "BACKLOG", priority: "HIGH", type: "IMPROVEMENT" },
      { title: "Set up redirects from old URLs", status: "BACKLOG", priority: "MEDIUM", type: "TASK" },
      { title: "Cross-browser and device testing", status: "BACKLOG", priority: "MEDIUM", type: "TASK" },
    ],
  },
];
