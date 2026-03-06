import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

const signupSchema = z.object({
  fullName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export function useAuthForm(empresaSlug?: string) {
  const { signIn, signUp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        setErrors({ general: "Email ou senha incorretos" });
      } else if (error.message.includes("Email not confirmed")) {
        setErrors({ general: "Confirme seu email antes de fazer login" });
      } else {
        setErrors({ general: error.message });
      }
    }
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = signupSchema.safeParse({
      fullName: signupName,
      email: signupEmail,
      password: signupPassword,
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName, empresaSlug);
    if (error) {
      if (error.message.includes("already registered")) {
        setErrors({ general: "Este email já está cadastrado" });
      } else {
        setErrors({ general: error.message });
      }
    }
    setIsLoading(false);
  };

  return {
    isLoading,
    errors,
    setErrors,
    loginEmail, setLoginEmail,
    loginPassword, setLoginPassword,
    signupName, setSignupName,
    signupEmail, setSignupEmail,
    signupPassword, setSignupPassword,
    showPassword, setShowPassword,
    showSignupPassword, setShowSignupPassword,
    handleLogin,
    handleSignup,
  };
}
