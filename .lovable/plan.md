

## Plano: Criador de Rota no Mapa para Entregas

### O que será feito

Adicionar um botão "Criar Rota no Mapa" no formulário de Nova Entrega. Ao clicar, abre um mapa interativo onde o usuário:
1. Clica no ponto de **partida** (base/matriz)
2. Adiciona **pontos de parada** (clientes, lojas, filiais)
3. O sistema calcula automaticamente a **distância total** entre todos os pontos usando Haversine (já existe no projeto)
4. O KM é preenchido automaticamente no formulário

### Fluxo do usuário

```text
[Nova Entrega] → [Criar Rota no Mapa]
    ↓
Mapa abre em dialog fullscreen
    ↓
1. Clica no mapa → define ORIGEM (marcador verde)
2. Clica novamente → adiciona PARADA 1 (marcador numerado)
3. Clica novamente → adiciona PARADA 2, 3, N...
4. Linhas conectam os pontos na ordem
5. Distância total aparece em tempo real (ex: "32.4 km")
    ↓
[Confirmar Rota] → KM preenchido automaticamente
```

### Arquivos a criar/editar

1. **Novo componente: `src/components/transportadora/RouteMapDialog.tsx`**
   - Dialog com mapa Leaflet (mesmo padrão do `MapPickerDialog` já existente)
   - Estado: lista de waypoints `{lat, lng, label}[]`
   - Primeiro clique = origem, demais = paradas
   - Polylines conectando os pontos na ordem
   - Marcadores customizados: origem (verde), paradas (numeradas azuis)
   - Cálculo em tempo real da distância total usando `haversineDistance` (já existe em `src/lib/haversine.ts`)
   - Busca de endereço por texto (reutiliza `geocodeAddress` de `src/lib/geocoding.ts`)
   - Botão "Desfazer último ponto" e "Limpar rota"
   - Botão "Confirmar" retorna o KM total calculado
   - Fator de correção de 1.3x sobre a distância em linha reta (Haversine dá linha reta; estradas reais são ~30% mais longas)

2. **Editar: `src/pages/transportadora/TranspEntregas.tsx`**
   - Adicionar botão "Criar Rota" ao lado do campo KM no formulário
   - Ao confirmar a rota, preenche automaticamente o campo `km` do form
   - Armazena os waypoints no campo `observacoes` (resumo textual da rota)

### Detalhes técnicos

- Usa `react-leaflet` (já instalado) com `Polyline` para desenhar a rota
- Usa `haversineDistance` (já existe) para calcular distância entre pontos consecutivos
- Aplica fator 1.3x para aproximar distância rodoviária real
- Reverse geocode cada ponto clicado para mostrar nome do endereço
- Sem necessidade de API paga (tudo OpenStreetMap/Nominatim)
- Sem alterações no banco de dados

