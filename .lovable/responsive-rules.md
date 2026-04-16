# PADRÃO GLOBAL DE RESPONSIVIDADE - GAS FACIL PRO

## OBJETIVO
Garantir que TODO o sistema funcione perfeitamente em celular e desktop.

---

## REGRAS OBRIGATÓRIAS

### 1. CONTAINERS
Sempre usar:

```
className="w-full min-w-0 max-w-full"
```

---

### 2. FLEX / GRID

Sempre adicionar:

```
min-w-0
```

Exemplo correto:

```
<div className="flex gap-2 w-full min-w-0">
```

---

### 3. TEXTOS DINÂMICOS

Sempre usar:

```
truncate
```

ou

```
line-clamp-1
```

---

### 4. INPUTS

Padrão obrigatório:

```
className="w-full min-w-0"
```

Se for texto longo:

```
className="w-full min-w-0 truncate"
```

---

### 5. BOTÕES MOBILE

Altura mínima:

```
className="h-10"
```

---

### 6. GRID RESPONSIVO

Sempre definir base mobile:

```
grid grid-cols-1 lg:grid-cols-3
```

---

### 7. PROIBIDO

❌ Não usar apenas:
- flex sem min-w-0
- inputs sem w-full
- textos sem truncate

---

## RESULTADO ESPERADO

- Nenhum layout quebrando no celular
- Nenhum scroll horizontal
- Uso confortável para entregadores
- Sistema profissional padrão SaaS

---

## INSTRUÇÃO PARA LOVABLE

Sempre aplicar essas regras automaticamente em qualquer nova tela ou componente criado.
