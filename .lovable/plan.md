

## Plano: Link para download do APK no menu RH

### Alterações

**1. `src/components/layout/menuItems.ts`**
- Adicionar `externalUrl?: string` opcional na interface `SubMenuItem`
- Adicionar item no submenu "Gestão de RH": `{ icon: Download, label: "APK Entregador", externalUrl: "https://github.com/ricgomes2016-boop/gasfacilpro/actions/workflows/android-build.yml" }`

**2. `src/components/layout/Sidebar.tsx`** (linha ~479)
- No render dos subitems, verificar `subItem.externalUrl`: se existir, renderizar `<a href={url} target="_blank">` em vez de `<Link to={path}>`

**3. `src/components/layout/MobileNav.tsx`**
- Mesma lógica para o menu mobile

### Escopo
- 3 arquivos modificados
- Zero mudanças de banco

