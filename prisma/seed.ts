import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/server/auth/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ADMINS = [
  {
    name: "Quý Minh",
    email: process.env.SEED_ADMIN1_EMAIL ?? "admin1@financehub.local",
    password: process.env.SEED_ADMIN1_PASSWORD ?? "ChangeMe123!",
  },
  {
    name: "Nhân Khải",
    email: process.env.SEED_ADMIN2_EMAIL ?? "admin2@financehub.local",
    password: process.env.SEED_ADMIN2_PASSWORD ?? "ChangeMe123!",
  },
];

async function main() {
  for (const admin of ADMINS) {
    const email = admin.email.toLowerCase();
    const passwordHash = await hashPassword(admin.password);
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { name: admin.name, email, passwordHash, role: "ADMIN", status: "ACTIVE" },
    });
    console.log(`Seeded admin: ${user.email} / password: ${admin.password}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
