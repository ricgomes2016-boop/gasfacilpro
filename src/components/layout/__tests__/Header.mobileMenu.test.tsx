import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// --- Mocks for all heavy dependencies Header pulls in ---
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "test@test.com" },
    profile: { full_name: "Tester" },
    roles: ["admin"],
    signOut: vi.fn(),
  }),
}));
vi.mock("@/contexts/UnidadeContext", () => ({
  useUnidade: () => ({ unidadeAtual: { id: "1", nome: "Matriz" } }),
}));
vi.mock("@/contexts/EmpresaContext", () => ({
  useEmpresa: () => ({ empresa: { id: "e1", nome: "Empresa Teste" } }),
}));
vi.mock("@/contexts/SidebarContext", () => ({
  useSidebarContext: () => ({ collapsed: false, toggle: vi.fn(), setCollapsed: vi.fn() }),
}));
vi.mock("@/hooks/useDashboardTheme", () => ({
  useDashboardTheme: () => ({
    themeClass: "brand-theme-operacional-clean",
    brandTheme: { logoMark: "/logo.png", name: "Gas Facil" },
  }),
}));

// Stub out heavy child components — we only care about the menu trigger structure
vi.mock("../MobileNav", () => ({
  MobileNav: () => (
    <button data-testid="mobile-nav-trigger" className="xl:hidden">
      Menu Mobile
    </button>
  ),
}));
vi.mock("../CommandPalette", () => ({ CommandPalette: () => null }));
vi.mock("../NotificationCenter", () => ({ NotificationCenter: () => null }));
vi.mock("../UnidadeSelector", () => ({ UnidadeSelector: () => null }));
vi.mock("@/components/chat/BaseChatPanel", () => ({ BaseChatPanel: () => null }));
vi.mock("@/components/shared/BuildVersionBadge", () => ({ BuildVersionBadge: () => null }));
vi.mock("@/components/shared/CalculatorPopover", () => ({ CalculatorPopover: () => null }));
vi.mock("@/lib/force-app-update", () => ({ forceAppUpdate: vi.fn() }));

import { Header } from "../Header";

function renderHeader() {
  return render(
    <MemoryRouter>
      <Header title="Dashboard" />
    </MemoryRouter>
  );
}

describe("Header mobile menu (Operacional Clean)", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("data-theme-preset", "operacional-clean");
  });

  it("does not render the legacy MobileNav trigger (clean uses off-canvas sidebar drawer)", () => {
    renderHeader();
    expect(screen.queryByTestId("mobile-nav-trigger")).not.toBeInTheDocument();
  });

  it("renders a single hamburger button visible on all sizes that toggles the sidebar drawer", () => {
    renderHeader();
    const collapseBtn = screen.getByRole("button", { name: /fechar menu|abrir menu/i });
    expect(collapseBtn.className).toMatch(/clean-header-menu/);
    expect(collapseBtn.className).toMatch(/inline-flex/);
    expect(collapseBtn.className).not.toMatch(/\bhidden\b/);
  });
});
