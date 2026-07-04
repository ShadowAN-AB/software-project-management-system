import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@pms.dev" },
    update: {},
    create: {
      email: "admin@pms.dev",
      name: "Admin User",
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const pm = await prisma.user.upsert({
    where: { email: "pm@pms.dev" },
    update: {},
    create: {
      email: "pm@pms.dev",
      name: "Sarah Connor",
      passwordHash,
      role: Role.PROJECT_MANAGER,
    },
  });

  const dev = await prisma.user.upsert({
    where: { email: "dev@pms.dev" },
    update: {},
    create: {
      email: "dev@pms.dev",
      name: "John Doe",
      passwordHash,
      role: Role.DEVELOPER,
    },
  });

  const tester = await prisma.user.upsert({
    where: { email: "tester@pms.dev" },
    update: {},
    create: {
      email: "tester@pms.dev",
      name: "Jane Smith",
      passwordHash,
      role: Role.TESTER,
    },
  });

  const project = await prisma.project.upsert({
    where: { key: "PMS" },
    update: {},
    create: {
      name: "Project Management System",
      key: "PMS",
      description: "Internal project management tool",
      status: "ACTIVE",
      startDate: new Date(),
    },
  });

  await prisma.projectMember.createMany({
    data: [
      { userId: admin.id, projectId: project.id, role: Role.ADMIN },
      { userId: pm.id, projectId: project.id, role: Role.PROJECT_MANAGER },
      { userId: dev.id, projectId: project.id, role: Role.DEVELOPER },
      { userId: tester.id, projectId: project.id, role: Role.TESTER },
    ],
    skipDuplicates: true,
  });

  console.log("Seeded:", { admin, pm, dev, tester, project });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
