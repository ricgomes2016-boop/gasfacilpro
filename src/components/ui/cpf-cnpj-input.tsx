import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { formatCpfCnpj, validateCpfCnpj } from "@/hooks/useInputMasks";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface CpfCnpjInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showValidation?: boolean;
}

export function CpfCnpjInput({
  value,
  onChange,
  placeholder = "000.000.000-00 ou 00.000.000/0000-00",
  className,
  showValidation = true,
}: CpfCnpjInputProps) {
  const [validation, setValidation] = useState<{
    valid: boolean;
    type: "cpf" | "cnpj" | null;
    message: string;
  }>({ valid: true, type: null, message: "" });

  useEffect(() => {
    const result = validateCpfCnpj(value);
    setValidation(result);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCpfCnpj(e.target.value);
    onChange(formatted);
  };

  const numbers = value.replace(/\D/g, "");
  const isComplete = numbers.length === 11 || numbers.length === 14;
  const showStatus = showValidation && numbers.length > 0;

  return (
    <div className="space-y-1 min-w-0">
      <div className="relative min-w-0">
        <Input
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className={cn(
            "w-full min-w-0",
            showStatus && isComplete && validation.valid && "border-success focus-visible:ring-success",
            showStatus && isComplete && !validation.valid && "border-destructive focus-visible:ring-destructive",
            className
          )}
          maxLength={18} // 00.000.000/0000-00
        />
        {showStatus && isComplete && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {validation.valid ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
          </div>
        )}
      </div>
      {showStatus && (
        <p
          className={cn(
            "flex items-start gap-1 break-words text-xs leading-snug",
            validation.valid ? "text-success" : "text-destructive"
          )}
        >
          {!isComplete ? (
            <>
              <AlertCircle className="h-3 w-3" />
              {numbers.length <= 11 ? `CPF: faltam ${11 - numbers.length} dígitos` : `CNPJ: faltam ${14 - numbers.length} dígitos`}
            </>
          ) : validation.valid ? (
            <>
              <CheckCircle2 className="h-3 w-3" />
              {validation.type === "cpf" ? "CPF válido" : "CNPJ válido"}
            </>
          ) : (
            <>
              <XCircle className="h-3 w-3" />
              {validation.message}
            </>
          )}
        </p>
      )}
    </div>
  );
}
