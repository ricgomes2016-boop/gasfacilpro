import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";
import { phoneToEmail, isValidPhone } from "@/lib/phoneAuth";

const emailLoginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

const phoneLoginSchema = z.object({
  phone: z.string().refine((v) => isValidPhone(v), "Telefone inválido (mín. 10 dígitos)"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

const emailSignupSchema = z.object({
  fullName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

const phoneSignupSchema = z.object({
  fullName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  phone: z.string().refine((v) => isValidPhone(v), "Telefone inválido (mín. 10 dígitos)"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export type LoginMethod = "email" | "phone";

export function useAuthForm(empresaSlug?: string, defaultLoginMethod: LoginMethod = "phone") {
  const { signIn, signUp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loginMethod, setLoginMethod] = useState<LoginMethod>(defaultLoginMethod);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    let emailForAuth: string;

    if (loginMethod === "email") {
      const result = emailLoginSchema.safeParse({ email: loginEmail, password: loginPassword });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.errors.forEach((err) => {
          if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message;
        });
        setErrors(fieldErrors);
        return;
      }
      emailForAuth = loginEmail;
    } else {
      const result = phoneLoginSchema.safeParse({ phone: loginPhone, password: loginPassword });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.errors.forEach((err) => {
          if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message;
        });
        setErrors(fieldErrors);
        return;
      }
      emailForAuth = phoneToEmail(loginPhone);
    }

    setIsLoading(true);
    const { error } = await signIn(emailForAuth, loginPassword);
    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        setErrors({ general: loginMethod === "phone" ? "Telefone ou senha incorretos" : "Email ou senha incorretos" });
      } else if (error.message.includes("Email not confirmed")) {
        setErrors({ general: "Confirme seu cadastro antes de fazer login" });
      } else {
        setErrors({ general: error.message });
      }
    }
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    let emailForAuth: string;
    let phoneValue: string | undefined;

    if (loginMethod === "email") {
      const result = emailSignupSchema.safeParse({
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
      emailForAuth = signupEmail;
    } else {
      const result = phoneSignupSchema.safeParse({
        fullName: signupName,
        phone: signupPhone,
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
      emailForAuth = phoneToEmail(signupPhone);
      phoneValue = signupPhone;
    }

    setIsLoading(true);
    const { error } = await signUp(emailForAuth, signupPassword, signupName, empresaSlug, phoneValue);
    if (error) {
      if (error.message.includes("already registered")) {
        setErrors({ general: loginMethod === "phone" ? "Este telefone já está cadastrado" : "Este email já está cadastrado" });
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
    loginMethod, setLoginMethod,
    loginEmail, setLoginEmail,
    loginPhone, setLoginPhone,
    loginPassword, setLoginPassword,
    signupName, setSignupName,
    signupEmail, setSignupEmail,
    signupPhone, setSignupPhone,
    signupPassword, setSignupPassword,
    showPassword, setShowPassword,
    showSignupPassword, setShowSignupPassword,
    handleLogin,
    handleSignup,
  };
}
