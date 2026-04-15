

## Plano: Seleção de cidades no app do entregador para rotas atacado

### Problema
Quando o entregador seleciona uma rota do tipo "atacado" no app, ele não pode escolher quais cidades vai percorrer naquele dia. Algumas cidades são opcionais e ele precisa marcar quais visitará.

### Solução
Ao selecionar uma rota atacado na tela de Iniciar Jornada, exibir a lista de cidades da rota com checkboxes. Cidades fixas ficam marcadas e desabilitadas. Cidades opcionais podem ser marcadas/desmarcadas pelo entregador.

### Mudanças técnicas

| Arquivo | Mudança |
|---|---|
| `EntregadorIniciarJornada.tsx` | Buscar `tipo` e `cidades` da `rotas_definidas`. Quando rota atacado selecionada, exibir lista de cidades com checkboxes. Cidades não-opcionais = sempre marcadas. Cidades opcionais = toggle. Salvar seleção junto com a jornada. |

### Interface atualizada `RotaDefinida`
```text
interface RotaDefinida {
  id: string;
  nome: string;
  bairros: string[];
  distancia_km: number | null;
  tempo_estimado: string | null;
  tipo?: string;
  cidades?: CidadeRota[];
}
```

### UI no app entregador
- Após selecionar rota atacado, aparece card com lista de cidades
- Cada cidade mostra: checkbox + nome + KM + badge "Opcional" (se aplicável)
- Cidades fixas (`opcional: false`): checkbox marcado e desabilitado
- Cidades opcionais (`opcional: true`): checkbox editável pelo entregador
- Visual compacto, integrado ao card de rota existente (seção 3)

### Dados salvos
- As cidades selecionadas são salvas no registro da rota (`rotas` table) em campo `observacoes` ou similar como JSON, para rastreabilidade de quais cidades o entregador escolheu naquele dia

