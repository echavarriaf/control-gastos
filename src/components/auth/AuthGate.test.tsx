import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({ state: {
  user: { uid: "test-user" } as { uid: string } | null,
  authorized: false,
  loading: false,
  error: null as string | null,
  accessRequest: null as object | null,
  refreshAuthorization: vi.fn(),
  signOutUser: vi.fn(),
} }));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => state }));
vi.mock("./LoginScreen", () => ({ LoginScreen: () => "Login" }));
vi.mock("./UnauthorizedScreen", () => ({ UnauthorizedScreen: () => "Solicitud pendiente" }));
import { AuthGate } from "./AuthGate";

beforeEach(() => {
  Object.assign(state, { user: { uid: "test-user" }, authorized: false, loading: false, error: null, accessRequest: null });
});

function render() {
  return renderToStaticMarkup(<AuthGate><span>Datos privados</span></AuthGate>);
}

it("offers retry after a verification failure without exposing private data", () => {
  state.error = "No se pudo conectar";
  const html = render();
  expect(html).toContain("Reintentar");
  expect(html).toContain("No se pudo conectar");
  expect(html).not.toContain("Datos privados");
  expect(html).not.toContain("Solicitud pendiente");
});

it("keeps private data hidden while checking access", () => {
  state.loading = true;
  expect(render()).toContain("Verificando acceso");
  expect(render()).not.toContain("Datos privados");
});

it("only renders private data after authorization", () => {
  state.authorized = true;
  expect(render()).toContain("Datos privados");
});
