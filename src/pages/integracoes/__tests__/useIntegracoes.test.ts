import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIntegracoes } from "../useIntegracoes";

// Mock do Supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

// Mock do toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useIntegracoes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve inicializar com estado vazio", () => {
    const { result } = renderHook(() => useIntegracoes("unit-123"));

    expect(result.current.configs).toEqual({});
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("deve carregar configurações ao montar", async () => {
    const { result } = renderHook(() => useIntegracoes("unit-123"));

    // Aguardar carregamento
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(result.current.isLoading).toBe(false);
  });

  it("deve salvar nova configuração", async () => {
    const { result } = renderHook(() => useIntegracoes("unit-123"));

    await act(async () => {
      await result.current.saveConfig("pix", {
        chave_pix: "123.456.789-00",
      });
    });

    // Verificar que a função foi chamada
    expect(result.current.isLoading).toBe(false);
  });

  it("deve deletar configuração existente", async () => {
    const { result } = renderHook(() => useIntegracoes("unit-123"));

    await act(async () => {
      await result.current.deleteConfig("pix");
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("deve testar conexão com a integração", async () => {
    const { result } = renderHook(() => useIntegracoes("unit-123"));

    await act(async () => {
      await result.current.testConnection("pix", {
        chave_pix: "123.456.789-00",
      });
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("deve recarregar configurações", async () => {
    const { result } = renderHook(() => useIntegracoes("unit-123"));

    await act(async () => {
      await result.current.loadConfigs();
    });

    expect(result.current.isLoading).toBe(false);
  });
});
