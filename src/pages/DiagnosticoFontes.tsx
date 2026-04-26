const amostras = [
  { titulo: "Tabela", texto: "GÁS P13 13 KG — R$ 125,00 — Margem 18,45%", classe: "text-[13px] font-medium leading-[1.35]" },
  { titulo: "Rótulo", texto: "Preço médio de venda", classe: "text-sm font-semibold leading-[1.25]" },
  { titulo: "Botão", texto: "Finalizar venda", classe: "text-sm font-semibold leading-[1.25]" },
  { titulo: "Valor", texto: "R$ 12.485,90", classe: "text-lg font-bold leading-[1.2] tabular-nums" },
];

export default function DiagnosticoFontes() {
  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6">
      <section className="mx-auto max-w-3xl space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diagnóstico visual</p>
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Nitidez de fontes</h1>
          <p className="text-sm font-medium leading-relaxed text-muted-foreground">
            Compare pesos, tamanhos, espaçamento e suavização em telas Android/iOS antes de validar o app.
          </p>
        </div>

        <div className="grid gap-3">
          {amostras.map((item) => (
            <article key={item.titulo} className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.titulo}</p>
              <p className={item.classe}>{item.texto}</p>
            </article>
          ))}
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-base font-bold leading-tight">Checklist mobile</h2>
          <ul className="space-y-2 text-sm font-medium leading-relaxed text-muted-foreground">
            <li>✓ Textos de tabelas legíveis em 390px sem micro-truncamento.</li>
            <li>✓ Valores monetários com números tabulares para alinhamento estável.</li>
            <li>✓ Botões, inputs e labels com peso e line-height consistentes.</li>
            <li>✓ Fallbacks nativos configurados caso a fonte principal demore a carregar.</li>
            <li>✓ Focus ring visível para navegação por toque, teclado e baixa luminosidade.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}