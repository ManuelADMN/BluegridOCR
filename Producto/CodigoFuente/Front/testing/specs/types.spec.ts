import {
  INITIAL_DASHBOARD_STATE,
  MOCK_ZONES,
  ROLE_PERMISSIONS,
  hasRolePermission,
} from "../../types";

describe("role permissions", () => {
  it("declares the expected application roles", () => {
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(["admin", "buzo", "supervisor"]);
  });

  it("allows admin to access every declared permission through admin:all", () => {
    const permissions = Object.values(ROLE_PERMISSIONS).flat();

    permissions.forEach(permission => {
      expect(hasRolePermission("admin", permission)).toBeTrue();
    });
  });

  it("limits supervisor access to dashboard, OCR and buzo analytics", () => {
    expect(hasRolePermission("supervisor", "dashboard:view")).toBeTrue();
    expect(hasRolePermission("supervisor", "ocr:digitalize")).toBeTrue();
    expect(hasRolePermission("supervisor", "analytics:buzo_view")).toBeTrue();
    expect(hasRolePermission("supervisor", "users:create")).toBeFalse();
    expect(hasRolePermission("supervisor", "settings:manage")).toBeFalse();
  });

  it("limits buzo access to OCR digitalization only", () => {
    expect(hasRolePermission("buzo", "ocr:digitalize")).toBeTrue();
    expect(hasRolePermission("buzo", "dashboard:view")).toBeFalse();
    expect(hasRolePermission("buzo", "records:validate")).toBeFalse();
    expect(hasRolePermission("buzo", "analytics:buzo_view")).toBeFalse();
  });

  it("denies permissions when role is empty", () => {
    expect(hasRolePermission(null, "dashboard:view")).toBeFalse();
    expect(hasRolePermission(undefined, "ocr:digitalize")).toBeFalse();
  });

  it("denies permissions for an unknown runtime role", () => {
    expect(hasRolePermission("guest" as any, "dashboard:view")).toBeFalse();
  });

  it("keeps user creation restricted to admin", () => {
    expect(hasRolePermission("admin", "users:create")).toBeTrue();
    expect(hasRolePermission("supervisor", "users:create")).toBeFalse();
    expect(hasRolePermission("buzo", "users:create")).toBeFalse();
  });

  it("keeps settings management restricted to admin", () => {
    expect(hasRolePermission("admin", "settings:manage")).toBeTrue();
    expect(hasRolePermission("supervisor", "settings:manage")).toBeFalse();
    expect(hasRolePermission("buzo", "settings:manage")).toBeFalse();
  });
});

describe("system seed data", () => {
  it("ships with selectable zone options", () => {
    expect(MOCK_ZONES.length).toBeGreaterThan(0);
    expect(MOCK_ZONES.every(zone => zone.id && zone.name)).toBeTrue();
  });

  it("starts dashboard state with empty collections", () => {
    expect(INITIAL_DASHBOARD_STATE.kpis).toEqual([]);
    expect(INITIAL_DASHBOARD_STATE.barData).toEqual([]);
    expect(INITIAL_DASHBOARD_STATE.lineData).toEqual([]);
    expect(INITIAL_DASHBOARD_STATE.mapData).toEqual([]);
  });

  it("uses unique zone ids", () => {
    const ids = MOCK_ZONES.map(zone => zone.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses numeric string ids for zone options", () => {
    expect(MOCK_ZONES.every(zone => /^\d+$/.test(zone.id))).toBeTrue();
  });

  it("exposes all dashboard collection keys", () => {
    expect(Object.keys(INITIAL_DASHBOARD_STATE).sort()).toEqual([
      "barData",
      "context",
      "kpis",
      "lineData",
      "mapData",
      "summary",
    ]);
  });

  it("starts dashboard context and summary empty until the API responds", () => {
    expect(INITIAL_DASHBOARD_STATE.context).toBeUndefined();
    expect(INITIAL_DASHBOARD_STATE.summary).toBeUndefined();
  });
});
