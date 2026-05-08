# Guia de Otimização de Performance - GasFácil

## 1. Análise de Bundle Size

### Gerar Relatório de Bundle
```bash
npm install --save-dev rollup-plugin-visualizer
vite build --config vite.config.analysis.ts
```

Isso gerará um arquivo `dist/stats.html` com visualização interativa do bundle.

### Tamanho Atual
- **Estimado:** ~500KB (minificado)
- **Meta:** <300KB
- **Dependências:** 80+ pacotes

## 2. Recomendações de Redução

### 2.1 Remover Dependências Não Utilizadas
```bash
# Analisar dependências não utilizadas
npm prune --production

# Verificar dependências específicas
npm ls leaflet  # Se não usado em todas as páginas
npm ls recharts # Se usado apenas em alguns dashboards
```

### 2.2 Lazy Loading de Rotas
```typescript
// ❌ Antes: Importação direta
import { Integracoes } from "@/pages/Integracoes";

// ✅ Depois: Lazy loading
const Integracoes = lazy(() => import("@/pages/Integracoes"));

// No App.tsx
<Route path="/integracoes" element={
  <Suspense fallback={<LoadingSpinner />}>
    <Integracoes />
  </Suspense>
} />
```

### 2.3 Dynamic Imports para Componentes Pesados
```typescript
// Para componentes que não são críticos no carregamento inicial
const HeavyChart = dynamic(() => import("@/components/HeavyChart"), {
  loading: () => <Skeleton />,
});
```

### 2.4 Code Splitting por Módulo
```typescript
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        "react-vendor": ["react", "react-dom"],
        "ui-vendor": ["@radix-ui/react-*"],
        "map-vendor": ["leaflet", "@react-leaflet/core"],
        "integracoes": ["src/pages/integracoes"],
      },
    },
  },
}
```

## 3. Otimizações de Runtime

### 3.1 Memoização de Componentes
```typescript
// ❌ Sem memoização: re-renderiza sempre
export function IntegracaoCard(props) {
  return <Card>...</Card>;
}

// ✅ Com memoização: só re-renderiza se props mudarem
export const IntegracaoCard = memo(function IntegracaoCard(props) {
  return <Card>...</Card>;
});
```

### 3.2 useCallback para Funções
```typescript
// ❌ Nova função a cada render
const handleClick = () => doSomething();

// ✅ Função memoizada
const handleClick = useCallback(() => {
  doSomething();
}, []);
```

### 3.3 useMemo para Cálculos Pesados
```typescript
// ❌ Recalcula a cada render
const filteredItems = integracoes.filter(i => i.status === "conectado");

// ✅ Memoizado
const filteredItems = useMemo(
  () => integracoes.filter(i => i.status === "conectado"),
  [integracoes]
);
```

## 4. Otimizações de Imagens

### 4.1 WebP com Fallback
```tsx
<picture>
  <source srcSet="image.webp" type="image/webp" />
  <img src="image.jpg" alt="..." loading="lazy" />
</picture>
```

### 4.2 Lazy Loading
```tsx
<img src="image.jpg" alt="..." loading="lazy" />
```

### 4.3 Compressão
```bash
# Usar ferramentas como:
# - ImageOptim (macOS)
# - FileOptimizer (Windows)
# - ImageMagick (CLI)

convert image.jpg -quality 85 image-optimized.jpg
```

## 5. Monitoramento de Performance

### 5.1 Lighthouse
```bash
# Usar Chrome DevTools > Lighthouse
# Meta: Score > 90 em todas as categorias
```

### 5.2 Web Vitals
```typescript
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log);  // Cumulative Layout Shift
getFID(console.log);  // First Input Delay
getFCP(console.log);  // First Contentful Paint
getLCP(console.log);  // Largest Contentful Paint
getTTFB(console.log); // Time to First Byte
```

### 5.3 React DevTools Profiler
```typescript
// Em desenvolvimento, use React DevTools para identificar renders desnecessários
// Chrome DevTools > Profiler > Record
```

## 6. Checklist de Otimização

- [ ] Analisar bundle com Rollup Visualizer
- [ ] Implementar lazy loading para rotas
- [ ] Remover dependências não utilizadas
- [ ] Memoizar componentes críticos
- [ ] Otimizar imagens (WebP, compressão)
- [ ] Implementar code splitting
- [ ] Testar performance com Lighthouse
- [ ] Monitorar Web Vitals
- [ ] Configurar CI/CD para alertas de bundle size

## 7. Ferramentas Recomendadas

| Ferramenta | Uso | Comando |
|-----------|-----|---------|
| Rollup Visualizer | Análise de bundle | `vite build --config vite.config.analysis.ts` |
| Lighthouse | Auditoria de performance | Chrome DevTools |
| Web Vitals | Monitoramento de métricas | npm package |
| Bundle Analyzer | Análise de dependências | `npm ls` |
| Bundlesize | CI/CD alerts | GitHub Actions |

## 8. Próximos Passos

1. Executar análise de bundle
2. Identificar dependências pesadas
3. Implementar lazy loading para páginas menos usadas
4. Configurar code splitting automático
5. Monitorar performance em produção

---

**Última atualização:** 8 de Maio de 2026
