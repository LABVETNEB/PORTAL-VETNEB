import { expect, test, type APIRequestContext } from "@playwright/test";
import { sessionCookieHeader } from "../../helpers/session";

const API_BASE_URL = "http://127.0.0.1:3107";
const POPULATED_ADMIN_COOKIE = sessionCookieHeader("admin", "populated");

type AdminUsersFixtureItem = {
  userType: "admin" | "clinic";
  userId: number;
  username: string;
  role: "admin" | "clinic_owner" | "clinic_staff";
  status?: string;
};

type AdminUsersFixtureBody = {
  success: true;
  users: AdminUsersFixtureItem[];
  total: number;
  limit: number;
  offset: number;
  totals: {
    adminUsers: number;
    clinicUsers: number;
  };
};

async function readAdminUsersFixture(
  request: APIRequestContext,
  path: string,
): Promise<AdminUsersFixtureBody> {
  const response = await request.get(`${API_BASE_URL}${path}`, {
    headers: { Cookie: POPULATED_ADMIN_COOKIE },
  });

  expect(response.ok()).toBe(true);
  return (await response.json()) as AdminUsersFixtureBody;
}

test.describe("admin users populated fixture pagination (CAP-A1)", () => {
  test("/api/admin/users-roles returns a 5000-user deterministic paginated dataset", async ({
    request,
  }) => {
    const body = await readAdminUsersFixture(
      request,
      "/api/admin/users-roles?dataset=high-volume&limit=10&offset=0",
    );

    expect(body.total).toBe(5000);
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(0);
    expect(body.users).toHaveLength(10);
    expect(body.users.map((user) => user.username).slice(0, 3)).toEqual([
      "admin_operaciones",
      "usuario_clinica_01",
      "usuario_clinica_02",
    ]);
    expect(body.totals).toEqual({ adminUsers: 250, clinicUsers: 4750 });
  });

  test("/api/admin/users-roles caps oversized limits and offset changes the slice", async ({
    request,
  }) => {
    const firstPage = await readAdminUsersFixture(
      request,
      "/api/admin/users-roles?dataset=high-volume&limit=250&offset=0",
    );
    const secondPage = await readAdminUsersFixture(
      request,
      "/api/admin/users-roles?dataset=high-volume&limit=250&offset=100",
    );

    expect(firstPage.limit).toBe(100);
    expect(firstPage.users).toHaveLength(100);
    expect(secondPage.limit).toBe(100);
    expect(secondPage.offset).toBe(100);
    expect(secondPage.users).toHaveLength(100);
    expect(secondPage.users[0].userId).not.toBe(firstPage.users[0].userId);
  });

  test("/api/admin/users-roles honors userType and role filters", async ({
    request,
  }) => {
    const body = await readAdminUsersFixture(
      request,
      "/api/admin/users-roles?dataset=high-volume&userType=clinic&role=clinic_owner&limit=7&offset=7",
    );

    expect(body.total).toBe(2375);
    expect(body.limit).toBe(7);
    expect(body.offset).toBe(7);
    expect(body.users).toHaveLength(7);
    for (const user of body.users) {
      expect(user.userType).toBe("clinic");
      expect(user.role).toBe("clinic_owner");
    }
  });

  test("/api/admin/users-roles honors the production search filter", async ({
    request,
  }) => {
    const searchBody = await readAdminUsersFixture(
      request,
      "/api/admin/users-roles?dataset=high-volume&search=Cl%C3%ADnica%20Fixture%200100&limit=5&offset=0",
    );

    expect(searchBody.total).toBe(1);
    expect(searchBody.users).toHaveLength(1);
    expect(searchBody.users[0].username).toBe("usuario_clinica_fixture_0100");
  });
});
