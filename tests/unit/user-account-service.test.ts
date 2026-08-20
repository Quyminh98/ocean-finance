import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  listUserAccounts,
  setUserAccountStatus,
  UserAccountError,
} from "@/server/services/user-account.service";

let actorAdminId: string;
const createdUserIds: string[] = [];

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      name: "Test Admin (user-account-service)",
      email: `test-admin-${randomUUID()}@example.test`,
      passwordHash: "x",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  actorAdminId = admin.id;
  createdUserIds.push(admin.id);
});

afterAll(async () => {
  await prisma.employeeProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("listUserAccounts", () => {
  it("lists both ADMIN and USER roles, filterable by role and searchable by name/email", async () => {
    const suffix = randomUUID();
    const admin = await prisma.user.create({
      data: {
        name: `Zed Admin ${suffix}`,
        email: `test-zed-admin-${suffix}@example.test`,
        passwordHash: "x",
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    const user = await prisma.user.create({
      data: {
        name: `Zed User ${suffix}`,
        email: `test-zed-user-${suffix}@example.test`,
        passwordHash: "x",
        role: "USER",
        status: "ACTIVE",
      },
    });
    createdUserIds.push(admin.id, user.id);

    const searched = await listUserAccounts({ search: `Zed`, page: 1, pageSize: 20 });
    // Search is unscoped by suffix on purpose: confirms both fixtures surface together.
    const searchedIds = searched.items
      .filter((item) => item.name.includes(suffix))
      .map((item) => item.id);
    expect(searchedIds).toContain(admin.id);
    expect(searchedIds).toContain(user.id);

    const onlyAdmins = await listUserAccounts({ search: suffix, role: "ADMIN", page: 1, pageSize: 20 });
    expect(onlyAdmins.items.map((item) => item.id)).toEqual([admin.id]);

    const onlyUsers = await listUserAccounts({ search: suffix, role: "USER", page: 1, pageSize: 20 });
    expect(onlyUsers.items.map((item) => item.id)).toEqual([user.id]);
  });
});

describe("setUserAccountStatus", () => {
  it("toggles a USER account both directions and writes DEACTIVATE/ACTIVATE audit entries, idempotently", async () => {
    const user = await prisma.user.create({
      data: {
        name: "Toggle User",
        email: `test-toggle-user-${randomUUID()}@example.test`,
        passwordHash: "x",
        role: "USER",
        status: "ACTIVE",
      },
    });
    createdUserIds.push(user.id);

    await setUserAccountStatus(user.id, "INACTIVE", actorAdminId);
    await setUserAccountStatus(user.id, "INACTIVE", actorAdminId); // idempotent, no duplicate audit
    let after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after?.status).toBe("INACTIVE");
    const deactivateCount = await prisma.auditLog.count({
      where: { entityType: "User", entityId: user.id, action: "DEACTIVATE" },
    });
    expect(deactivateCount).toBe(1);

    await setUserAccountStatus(user.id, "ACTIVE", actorAdminId);
    after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after?.status).toBe("ACTIVE");
    const activateCount = await prisma.auditLog.count({
      where: { entityType: "User", entityId: user.id, action: "ACTIVATE" },
    });
    expect(activateCount).toBe(1);
  });

  it("rejects an unknown user id", async () => {
    await expect(setUserAccountStatus(randomUUID(), "INACTIVE", actorAdminId)).rejects.toThrow(UserAccountError);
  });

  it("blocks deactivating the last ACTIVE admin, but allows it once another admin is active", async () => {
    const otherActiveAdmins = await prisma.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { id: true },
    });
    const otherActiveAdminIds = otherActiveAdmins.map((row) => row.id);

    // Controlled isolation: temporarily park every other ACTIVE admin (incl.
    // the 2 real seed admins) so the guard's global count is deterministic,
    // then restore them in `finally` regardless of test outcome.
    await prisma.user.updateMany({ where: { id: { in: otherActiveAdminIds } }, data: { status: "INACTIVE" } });

    try {
      const lastAdmin = await prisma.user.create({
        data: {
          name: "Last Active Admin",
          email: `test-last-admin-${randomUUID()}@example.test`,
          passwordHash: "x",
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
      createdUserIds.push(lastAdmin.id);

      await expect(setUserAccountStatus(lastAdmin.id, "INACTIVE", actorAdminId)).rejects.toThrow(UserAccountError);
      const stillActive = await prisma.user.findUnique({ where: { id: lastAdmin.id } });
      expect(stillActive?.status).toBe("ACTIVE");

      const secondAdmin = await prisma.user.create({
        data: {
          name: "Second Admin",
          email: `test-second-admin-${randomUUID()}@example.test`,
          passwordHash: "x",
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
      createdUserIds.push(secondAdmin.id);

      await setUserAccountStatus(lastAdmin.id, "INACTIVE", actorAdminId);
      const nowInactive = await prisma.user.findUnique({ where: { id: lastAdmin.id } });
      expect(nowInactive?.status).toBe("INACTIVE");
    } finally {
      await prisma.user.updateMany({ where: { id: { in: otherActiveAdminIds } }, data: { status: "ACTIVE" } });
    }
  });

  it("never blocks deactivating a USER account regardless of admin count", async () => {
    const user = await prisma.user.create({
      data: {
        name: "Any User",
        email: `test-any-user-${randomUUID()}@example.test`,
        passwordHash: "x",
        role: "USER",
        status: "ACTIVE",
      },
    });
    createdUserIds.push(user.id);

    await setUserAccountStatus(user.id, "INACTIVE", actorAdminId);
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after?.status).toBe("INACTIVE");
  });
});
