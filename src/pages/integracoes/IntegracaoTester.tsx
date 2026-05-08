import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import type { IntegracaoTesterProps } from "./types";

export function IntegracaoTester({
  integracao,
  config,
  onTest,
  isLoading = false,
}: IntegracaoTesterProps) {
  const [testResult, setTestResult] = useState<{
    status: "idle" | "testing" | "success" | "error";
    message?: string;
  }>({ status: "idle" });

  const handleTest = async () => {
    setTestResult({ status: "testing" });
    try {
      await onTest();
      setTestResult({
        status: "success",
        message: "Conexão estabelecida com sucesso!",
      });
    } catch (error) {
      setTestResult({
        status: "error",
        message: error instanceof Error ? error.message : "Erro ao testar conexão",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Testar Conexão</CardTitle>
        <CardDescription>
          Valide se as credenciais estão corretas
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {testResult.status !== "idle" && (
          <div
            className={`p-3 rounded-lg flex items-center gap-2 ${
              testResult.status === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {testResult.status === "success" ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            <span className="text-sm">{testResult.message}</span>
          </div>
        )}

        <Button
          onClick={handleTest}
          disabled={
            isLoading ||
            testResult.status === "testing" ||
            Object.keys(config).length === 0
          }
          className="w-full"
        >
          {testResult.status === "testing" && (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          )}
          {testResult.status === "testing" ? "Testando..." : "Testar Conexão"}
        </Button>
      </CardContent>
    </Card>
  );
}
