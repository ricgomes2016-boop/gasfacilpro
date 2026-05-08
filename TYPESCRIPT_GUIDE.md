# Guia de Tipagem TypeScript - GasFácil

## 1. Remover `any` do Código

### Problema
```typescript
// ❌ Sem tipagem
function handleData(data: any) {
  return data.id;
}

const config: any = {};
```

### Solução
```typescript
// ✅ Com tipagem
interface User {
  id: string;
  name: string;
  email: string;
}

function handleData(data: User): string {
  return data.id;
}

const config: Record<string, unknown> = {};
```

## 2. Tipos Genéricos

### Para Componentes Reutilizáveis
```typescript
// ❌ Sem genéricos
interface ListProps {
  items: any[];
  renderItem: (item: any) => ReactNode;
}

// ✅ Com genéricos
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => ReactNode;
}

function List<T>({ items, renderItem }: ListProps<T>) {
  return <ul>{items.map(renderItem)}</ul>;
}
```

## 3. Tipos de Hooks

### useQuery
```typescript
// ✅ Com tipagem completa
interface User {
  id: string;
  name: string;
}

const { data: users } = useQuery<User[]>({
  queryKey: ["users"],
  queryFn: async () => {
    const res = await fetch("/api/users");
    return res.json();
  },
});
```

### useState
```typescript
// ❌ Sem tipagem
const [user, setUser] = useState();

// ✅ Com tipagem
interface User {
  id: string;
  name: string;
}

const [user, setUser] = useState<User | null>(null);
```

### useCallback
```typescript
// ✅ Com tipagem
const handleClick = useCallback<(id: string) => void>((id) => {
  console.log(id);
}, []);
```

## 4. Tipos de Componentes

### Componente Funcional
```typescript
// ✅ Com tipagem completa
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, ...props }, ref) => {
    return <button ref={ref} {...props} />;
  }
);
```

### Componente com Children
```typescript
// ✅ Com tipagem
interface CardProps {
  title: string;
  children: React.ReactNode;
}

export function Card({ title, children }: CardProps) {
  return (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
```

## 5. Tipos de Contexto

### Context Provider
```typescript
// ✅ Com tipagem
interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const value: AuthContextType = {
    user,
    login: async (email, password) => {
      // ...
    },
    logout: () => {
      setUser(null);
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}
```

## 6. Tipos de API

### Request/Response
```typescript
// ✅ Com tipagem
interface CreateUserRequest {
  name: string;
  email: string;
}

interface CreateUserResponse {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

async function createUser(
  data: CreateUserRequest
): Promise<CreateUserResponse> {
  const res = await fetch("/api/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.json();
}
```

## 7. Tipos de Formulários

### React Hook Form
```typescript
// ✅ Com tipagem
interface LoginFormData {
  email: string;
  password: string;
}

export function LoginForm() {
  const { register, handleSubmit } = useForm<LoginFormData>();

  const onSubmit = handleSubmit((data) => {
    // data é tipado como LoginFormData
    console.log(data.email);
  });

  return (
    <form onSubmit={onSubmit}>
      <input {...register("email")} />
      <input {...register("password")} type="password" />
    </form>
  );
}
```

## 8. Tipos de Utilitários

### Utility Types
```typescript
// ✅ Usar utility types do TypeScript
interface User {
  id: string;
  name: string;
  email: string;
}

// Partial: todos os campos opcionais
type PartialUser = Partial<User>;

// Required: todos os campos obrigatórios
type RequiredUser = Required<User>;

// Readonly: todos os campos readonly
type ReadonlyUser = Readonly<User>;

// Pick: selecionar campos específicos
type UserPreview = Pick<User, "id" | "name">;

// Omit: omitir campos específicos
type UserWithoutId = Omit<User, "id">;

// Record: criar objeto com chaves específicas
type UserRoles = Record<"admin" | "user" | "guest", User>;
```

## 9. Checklist de Tipagem

- [ ] Remover todos os `any` do código
- [ ] Tipar props de componentes
- [ ] Tipar retornos de funções
- [ ] Usar genéricos para componentes reutilizáveis
- [ ] Tipar hooks customizados
- [ ] Tipar contextos
- [ ] Tipar requisições de API
- [ ] Usar utility types quando apropriado
- [ ] Executar `tsc --noImplicitAny` para verificar

## 10. Executar Type Check

```bash
# Verificar tipos sem compilar
npm run check

# Ou manualmente
npx tsc --noEmit

# Com strict mode
npx tsc --strict --noEmit
```

---

**Última atualização:** 8 de Maio de 2026
