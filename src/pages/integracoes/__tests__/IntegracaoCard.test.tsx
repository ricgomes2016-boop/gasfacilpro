import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntegracaoCard } from "../IntegracaoCard";
import { CreditCard } from "lucide-react";
import type { Integracao } from "../types";

describe("IntegracaoCard", () => {
  const mockIntegracao: Integracao = {
    id: "pix",
    nome: "PIX Automático",
    descricao: "Geração de QR Code PIX",
    icon: CreditCard,
    status: "conectado",
    categoria: "pagamento",
    beneficios: ["QR Code dinâmico", "Conciliação automática"],
  };

  it("deve renderizar o card com informações da integração", () => {
    const mockOnConfigure = vi.fn();
    
    render(
      <IntegracaoCard
        integracao={mockIntegracao}
        onConfigure={mockOnConfigure}
        isConfigured={false}
      />
    );

    expect(screen.getByText("PIX Automático")).toBeInTheDocument();
    expect(screen.getByText("Geração de QR Code PIX")).toBeInTheDocument();
    expect(screen.getByText("Conectado")).toBeInTheDocument();
  });

  it("deve mostrar status 'Configurado' quando isConfigured é true", () => {
    const mockOnConfigure = vi.fn();
    
    render(
      <IntegracaoCard
        integracao={mockIntegracao}
        onConfigure={mockOnConfigure}
        isConfigured={true}
      />
    );

    expect(screen.getByText("Configurado")).toBeInTheDocument();
  });

  it("deve mostrar status 'Não configurado' quando isConfigured é false", () => {
    const mockOnConfigure = vi.fn();
    
    render(
      <IntegracaoCard
        integracao={mockIntegracao}
        onConfigure={mockOnConfigure}
        isConfigured={false}
      />
    );

    expect(screen.getByText("Não configurado")).toBeInTheDocument();
  });

  it("deve exibir benefícios da integração", () => {
    const mockOnConfigure = vi.fn();
    
    render(
      <IntegracaoCard
        integracao={mockIntegracao}
        onConfigure={mockOnConfigure}
        isConfigured={false}
      />
    );

    expect(screen.getByText("QR Code dinâmico")).toBeInTheDocument();
    expect(screen.getByText("Conciliação automática")).toBeInTheDocument();
  });

  it("deve chamar onConfigure quando botão é clicado", () => {
    const mockOnConfigure = vi.fn();
    
    const { getByRole } = render(
      <IntegracaoCard
        integracao={mockIntegracao}
        onConfigure={mockOnConfigure}
        isConfigured={false}
      />
    );

    const button = getByRole("button", { name: /Configurar/i });
    button.click();

    expect(mockOnConfigure).toHaveBeenCalledWith(mockIntegracao);
  });

  it("deve desabilitar botão quando status é 'em_breve'", () => {
    const mockOnConfigure = vi.fn();
    const integracaoEmBreve: Integracao = {
      ...mockIntegracao,
      status: "em_breve",
    };
    
    const { getByRole } = render(
      <IntegracaoCard
        integracao={integracaoEmBreve}
        onConfigure={mockOnConfigure}
        isConfigured={false}
      />
    );

    const button = getByRole("button", { name: /Configurar/i });
    expect(button).toBeDisabled();
  });
});
