

## Plano: Módulo "Rota Atacado Dinâmica" — Transportadora

### Resumo
Criar uma nova página `/transportadora/rota-atacado` com um sistema completo de planejamento de rotas atacado com múltiplas paradas tipadas, mapa interativo, controle de carga em tempo real, timeline visual e otimização automática de ordem.

### Banco de Dados — Nova Tabela

```sql
CREATE TABLE public.transp_rotas_atacado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'atacado', -- 'urbana' | 'atacado'
  veiculo_id uuid REFERENCES public.transp_veiculos(id),
  motorista_id uuid REFERENCES public.transp_funcionarios(id),
  ajudante_id uuid REFERENCES public.transp_funcionarios(id),
  status text NOT NULL DEFAULT 'rascunho', -- rascunho, planejada, em_andamento, concluida
  data_prevista date,
  km_total numeric(10,2) DEFAULT 0,
  tempo_total_min integer DEFAULT 0,
  custo_total numeric(10,2) DEFAULT 0,
  carga_inicial_p13 integer DEFAULT 0,
  carga_inicial_p20 integer DEFAULT 0,
  carga_inicial_p45 integer DEFAULT 0,
  consumo_km_litro numeric(6,2) DEFAULT 5.0,
  preco_combustivel numeric(6,2) DEFAULT 6.50,
  custo_pedagio numeric(10,2) DEFAULT 0,
  custo_refeicao numeric(10,2) DEFAULT 0,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.transp_rota_paradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id uuid REFERENCES public.transp_rotas_atacado(id) ON DELETE CASCADE NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  tipo_parada text NOT NULL DEFAULT 'venda', -- saida, coleta, transferencia, venda, retorno
  cidade text,
  endereco text,
  lat numeric(10,7),
  lng numeric(10,7),
  qtd_p13 integer DEFAULT 0,
  qtd_p20 integer DEFAULT 0,
  qtd_p45 integer DEFAULT 0,
  operacao text DEFAULT 'saida', -- 'entrada' | 'saida' (carga entra ou sai do caminhão)
  observacoes text,
  concluida boolean DEFAULT false,
  concluida_em timestamptz,
  created_at timestamptz DEFAULT now()
);
```

Com RLS por `empresa_id`, triggers de `updated_at`, e policies CRUD para authenticated.

### Frontend — Arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/transportadora/TranspRotaAtacado.tsx` | **Novo** — Página principal |
| `src/components/transportadora/rota-atacado/RotaAtacadoMap.tsx` | **Novo** — Mapa interativo Leaflet |
| `src/components/transportadora/rota-atacado/ParadaForm.tsx` | **Novo** — Formulário de parada |
| `src/components/transportadora/rota-atacado/CargaTimeline.tsx` | **Novo** — Timeline visual com evolução de carga |
| `src/components/transportadora/rota-atacado/RotaOptimizer.tsx` | **Novo** — Botão de otimização (nearest-neighbor) |
| `src/components/transportadora/rota-atacado/RotaSummaryCard.tsx` | **Novo** — Resumo com KM, tempo, custo |
| `src/routes/transportadoraRoutes.ts` | Adicionar rota `/transportadora/rota-atacado` |
| `src/components/transportadora/TransportadoraLayout.tsx` | Adicionar nav item "Rota Atacado" |

### Funcionalidades por Componente

**Página Principal (`TranspRotaAtacado.tsx`)**:
- Tabs: "Criar Rota" e "Rotas Salvas"
- Seleção de veículo (puxa capacidade), motorista, ajudante
- Carga inicial (P13/P20/P45)
- Custos (combustível, pedágio, refeição)
- Salvar/editar rotas no banco

**Mapa (`RotaAtacadoMap.tsx`)**:
- Clique no mapa adiciona parada com geocodificação reversa (Nominatim)
- Busca por endereço
- Marcadores coloridos por tipo de parada (saída=verde, coleta=azul, venda=laranja, transferência=roxo, retorno=vermelho)
- Polyline conectando paradas na ordem
- Drag & drop para reordenar (via lista lateral, não no mapa)

**Timeline de Carga (`CargaTimeline.tsx`)**:
- Lista vertical mostrando cada parada em ordem
- Carga acumulada atualizada a cada ponto (entrada soma, saída subtrai)
- Alerta visual (vermelho) se carga exceder capacidade do veículo
- Badge com tipo de operação

**Otimização (`RotaOptimizer.tsx`)**:
- Algoritmo nearest-neighbor (vizinho mais próximo) usando Haversine
- Botão "Otimizar Ordem" que reorganiza as paradas mantendo Saída como primeira e Retorno como última
- Exibe KM antes vs depois da otimização

**Resumo (`RotaSummaryCard.tsx`)**:
- KM total (Haversine × 1.3)
- Tempo estimado (velocidade média 60km/h)
- Custo combustível + pedágio + refeição + motorista + ajudante
- Custo por P13 equivalente

### Detalhes Técnicos

- Reutiliza `haversineDistance`, `reverseGeocode`, `geocodeAddress`, `calcP13Equivalente` e demais utils já existentes
- Marcadores Leaflet customizados por tipo de parada com `L.divIcon`
- Otimização nearest-neighbor é client-side, sem API externa
- Velocidade média de 60km/h para estimativa de tempo (configurável)
- Capacidade do veículo vem de `transp_veiculos.capacidade_p13/p20/p45`

