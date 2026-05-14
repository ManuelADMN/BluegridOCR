import { authFetch, clearAuthToken, getAuthToken } from "../../services/apiClient";

describe("apiClient", () => {
  const tokenKey = "bluegridocr_token";

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns the stored auth token", () => {
    localStorage.setItem(tokenKey, "test-token");

    expect(getAuthToken()).toBe("test-token");
  });

  it("clears the stored auth token", () => {
    localStorage.setItem(tokenKey, "test-token");

    clearAuthToken();

    expect(getAuthToken()).toBeNull();
  });

  it("adds bearer and ngrok headers when a token exists", async () => {
    localStorage.setItem(tokenKey, "jwt-123");
    const fetchSpy = spyOn(window, "fetch").and.resolveTo(new Response("{}"));

    await authFetch("http://localhost:8000/api/v1/dashboard/data", {
      headers: {
        "Content-Type": "application/json",
      },
    });

    const [, init] = fetchSpy.calls.mostRecent().args;
    const headers = init?.headers as Headers;

    expect(headers.get("Authorization")).toBe("Bearer jwt-123");
    expect(headers.get("ngrok-skip-browser-warning")).toBe("true");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("omits bearer authorization when no token exists", async () => {
    const fetchSpy = spyOn(window, "fetch").and.resolveTo(new Response("{}"));

    await authFetch("http://localhost:8000/api/v1/health");

    const [, init] = fetchSpy.calls.mostRecent().args;
    const headers = init?.headers as Headers;

    expect(headers.has("Authorization")).toBeFalse();
    expect(headers.get("ngrok-skip-browser-warning")).toBe("true");
  });

  it("preserves request options when adding auth headers", async () => {
    localStorage.setItem(tokenKey, "jwt-456");
    const fetchSpy = spyOn(window, "fetch").and.resolveTo(new Response("{}"));

    await authFetch("http://localhost:8000/api/v1/users", {
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ username: "buzo01" }),
    });

    const [, init] = fetchSpy.calls.mostRecent().args;

    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("include");
    expect(init?.body).toBe(JSON.stringify({ username: "buzo01" }));
  });

  it("overwrites stale authorization with the stored token", async () => {
    localStorage.setItem(tokenKey, "fresh-token");
    const fetchSpy = spyOn(window, "fetch").and.resolveTo(new Response("{}"));

    await authFetch("http://localhost:8000/api/v1/users", {
      headers: {
        Authorization: "Bearer stale-token",
      },
    });

    const [, init] = fetchSpy.calls.mostRecent().args;
    const headers = init?.headers as Headers;

    expect(headers.get("Authorization")).toBe("Bearer fresh-token");
  });

  it("forces the ngrok warning bypass header even when caller passes another value", async () => {
    const fetchSpy = spyOn(window, "fetch").and.resolveTo(new Response("{}"));

    await authFetch("http://localhost:8000/api/v1/health", {
      headers: {
        "ngrok-skip-browser-warning": "false",
      },
    });

    const [, init] = fetchSpy.calls.mostRecent().args;
    const headers = init?.headers as Headers;

    expect(headers.get("ngrok-skip-browser-warning")).toBe("true");
  });
});
