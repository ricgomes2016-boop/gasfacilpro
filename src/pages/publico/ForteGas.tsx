import { useState, useEffect } from "react";
import {
  Flame, Phone, MapPin, Truck, Shield, ChevronUp, MessageCircle,
  Droplets, Menu, X, Headset, PackageCheck, ArrowRight, Check,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import forteGasLogo from "@/assets/forte-gas-logo.png";
import { BiaChatWidget } from "@/components/publico/BiaChatWidget";

/* ============================================================
   Dados reais da unidade (Forte Gás — Cornélio Procópio/PR).
   Mantidos em um único objeto para facilitar a leitura futura
   a partir da configuração da unidade, sem afetar outras lojas.
   ============================================================ */
const LOJA = {
  nome: "Forte Gás",
  whatsappNumero: "5543984328383",
  telefoneExibicao: "(43) 98432-8383",
  telefoneTel: "5543984328383",
  endereco: "Rua Wilson de Barros Gatti, 10 — CL Fortunato Sibim",
  cidade: "Cornélio Procópio",
  estado: "PR",
};

const WHATSAPP_MSG = "Olá! Gostaria de fazer um pedido de gás na Forte Gás.";
const WHATSAPP_LINK = `https://wa.me/${LOJA.whatsappNumero}?text=${encodeURIComponent(WHATSAPP_MSG)}`;
const MAPS_LINK = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${LOJA.endereco}, ${LOJA.cidade} - ${LOJA.estado}`,
)}`;

/* ---------- Botões ---------- */
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0F2A4A] " +
  "min-h-[48px] px-6 text-[15px] w-full sm:w-auto";

function WhatsAppButton({ className = "", label = "Pedir pelo WhatsApp" }: { className?: string; label?: string }) {
  return (
    <a
      href={WHATSAPP_LINK}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} — ${LOJA.telefoneExibicao}`}
      style={{ color: "#ffffff" }}
      className={`${btnBase} bg-[#128C4A] hover:bg-[#0E7A40] shadow-sm ${className}`}
    >
      <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </a>
  );
}

function CallButton({ className = "", dark = false }: { className?: string; dark?: boolean }) {
  return (
    <a
      href={`tel:${LOJA.telefoneTel}`}
      aria-label={`Ligar agora para ${LOJA.telefoneExibicao}`}
      style={{ color: dark ? "#ffffff" : "#0F2A4A" }}
      className={`${btnBase} border ${dark ? "border-white/40 bg-transparent hover:bg-white/10" : "border-[#0F2A4A]/20 bg-white hover:bg-[#0F2A4A]/[0.06]"} ${className}`}
    >
      <Phone className="h-5 w-5 shrink-0" aria-hidden />
      <span className="truncate">Ligar agora</span>
    </a>
  );
}

/* ---------- Navbar ---------- */
const NAV_LINKS = [
  { label: "Produtos", href: "#produtos" },
  { label: "Como pedir", href: "#como-pedir" },
  { label: "Atendimento", href: "#atendimento" },
  { label: "Contato", href: "#contato" },
];

function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b transition-colors ${
        scrolled ? "border-slate-200 bg-white/95 backdrop-blur" : "border-transparent bg-white"
      }`}
    >
      <div className="mx-auto flex h-16 w-full min-w-0 max-w-6xl items-center justify-between gap-3 px-4">
        <a href="#inicio" className="flex min-w-0 items-center gap-2" aria-label="Forte Gás — início">
          <img src={forteGasLogo} alt="Forte Gás" className="h-9 w-auto sm:h-10" width={160} height={40} />
        </a>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Navegação principal">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-[#0F2A4A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2A4A]"
            >
              {l.label}
            </a>
          ))}
          <WhatsAppButton className="ml-2 !min-h-[42px] !px-4 !text-sm" label="Pedir agora" />
        </nav>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[#0F2A4A] hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2A4A] md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="menu-mobile"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div id="menu-mobile" className="border-t border-slate-200 bg-white px-4 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col" aria-label="Navegação mobile">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-[#0F2A4A]"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <WhatsAppButton className="mt-2" label="Pedir agora" />
        </div>
      )}
    </header>
  );
}

/* ---------- Hero ---------- */
function Hero() {
  return (
    <section id="inicio" className="relative w-full min-w-0 overflow-hidden bg-[#0F2A4A]">
      {/* Composição gráfica sutil, sem blur pesado */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(60% 80% at 85% 15%, rgba(232,98,12,0.35) 0%, transparent 60%), radial-gradient(70% 90% at 5% 90%, rgba(255,255,255,0.10) 0%, transparent 55%)",
        }}
      />
      <div className="relative mx-auto grid w-full min-w-0 max-w-6xl items-center gap-10 px-4 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
        <div className="min-w-0">
          <div className="mb-5 w-fit rounded-2xl bg-white p-3 shadow-lg sm:p-4">
            <img
              src={forteGasLogo}
              alt="Forte Gás — distribuidora de gás em Cornélio Procópio"
              className="h-14 w-auto sm:h-16"
              width={280}
              height={70}
            />
          </div>

          <p style={{ color: "#ffffff" }}
            className="mb-5 flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {LOJA.cidade} · {LOJA.estado}
          </p>

          <h1 style={{ color: "#ffffff" }} className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Gás e água entregues na sua porta em {LOJA.cidade}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-200">
            Botijão P13, cilindro P45 e água mineral com atendimento direto pelo WhatsApp ou telefone.
            Peça e a gente leva até você.
          </p>

          <div className="mt-8 flex w-full min-w-0 flex-col gap-3 sm:flex-row">
            <WhatsAppButton />
            <CallButton dark />
          </div>

          <p className="mt-4 text-sm text-slate-300">
            Ou ligue para{" "}
            <a
              href={`tel:${LOJA.telefoneTel}`}
              style={{ color: "#ffffff" }}
              className="font-semibold underline underline-offset-4"
            >
              {LOJA.telefoneExibicao}
            </a>
          </p>
        </div>

        {/* Cartão-resumo em vez de arte fotográfica inventada */}
        <div className="min-w-0 rounded-2xl border border-white/15 bg-white/[0.06] p-5 sm:p-6">
          <p style={{ color: "#FFB27A" }} className="text-xs font-semibold uppercase tracking-wider">Disponível hoje</p>
          <ul className="mt-4 space-y-3">
            {[
              { icon: Flame, t: "Gás P13", d: "Botijão de 13 kg para uso residencial" },
              { icon: Flame, t: "Gás P45", d: "Cilindro de 45 kg para comércio" },
              { icon: Droplets, t: "Água mineral", d: "Galões para casa e escritório" },
              { icon: Truck, t: "Entrega", d: `Atendimento em ${LOJA.cidade} e região` },
            ].map((i) => (
              <li key={i.t} className="flex min-w-0 items-start gap-3 rounded-xl bg-white/[0.06] p-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E8620C] text-white">
                  <i.icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span style={{ color: "#ffffff" }} className="block text-sm font-semibold">{i.t}</span>
                  <span className="block text-sm text-slate-300">{i.d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------- Produtos ---------- */
const PRODUTOS = [
  {
    icon: Flame,
    title: "Gás P13",
    desc: "Botijão de 13 kg, o mais usado na cozinha de casa. Troca rápida e conferida na entrega.",
  },
  {
    icon: Flame,
    title: "Gás P45",
    desc: "Cilindro de 45 kg para restaurantes, padarias e comércios com alto consumo.",
  },
  {
    icon: Droplets,
    title: "Água mineral",
    desc: "Galões de água mineral entregues junto com o seu pedido de gás.",
  },
  {
    icon: Truck,
    title: "Entrega local",
    desc: `Levamos o pedido até o endereço informado em ${LOJA.cidade} e região.`,
  },
];

function SectionTitle({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      <p style={{ color: "#C4530A" }} className="mb-2 text-xs font-bold uppercase tracking-[0.18em]">{eyebrow}</p>
      <h2 style={{ color: "#0F2A4A" }} className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      {desc && <p className="mt-3 text-base leading-relaxed text-slate-600">{desc}</p>}
    </div>
  );
}

function Produtos() {
  return (
    <section id="produtos" className="w-full min-w-0 bg-[#F6F7F9] py-16 sm:py-20">
      <div className="mx-auto w-full min-w-0 max-w-6xl px-4">
        <SectionTitle
          eyebrow="Produtos e serviços"
          title="O que a Forte Gás entrega"
          desc="Peça pelo WhatsApp e confirme os itens direto com o nosso atendimento."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PRODUTOS.map((p) => (
            <article
              key={p.title}
              className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-md"
            >
              <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#0F2A4A]/[0.06] text-[#0F2A4A]">
                <p.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 style={{ color: "#0F2A4A" }} className="text-base font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Como pedir ---------- */
const PASSOS = [
  { n: "1", t: "Chame no WhatsApp", d: "Toque no botão e a conversa abre já com a mensagem pronta." },
  { n: "2", t: "Informe o pedido e o endereço", d: "Diga o produto, a quantidade e onde entregar." },
  { n: "3", t: "Receba em casa", d: "Combinamos a forma de pagamento e levamos até você." },
];

function ComoPedir() {
  return (
    <section id="como-pedir" className="w-full min-w-0 bg-white py-16 sm:py-20">
      <div className="mx-auto w-full min-w-0 max-w-6xl px-4">
        <SectionTitle eyebrow="Como pedir" title="Três passos e o pedido está feito" />
        <ol className="grid gap-4 md:grid-cols-3">
          {PASSOS.map((p) => (
            <li key={p.n} className="min-w-0 rounded-2xl border border-slate-200 bg-[#F6F7F9] p-6">
              <span style={{ color: "#ffffff" }} className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#0F2A4A] text-sm font-bold">
                {p.n}
              </span>
              <h3 style={{ color: "#0F2A4A" }} className="text-base font-semibold">{p.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <WhatsAppButton />
          <CallButton />
        </div>
      </div>
    </section>
  );
}

/* ---------- Diferenciais factuais ---------- */
const DIFERENCIAIS = [
  { icon: Truck, t: "Entrega local", d: `Distribuição própria em ${LOJA.cidade} e região.` },
  { icon: Headset, t: "Atendimento direto", d: "Você fala com a loja, sem intermediários." },
  { icon: Shield, t: "Produtos certificados e seguros", d: "Botijões e cilindros conferidos antes da entrega." },
  { icon: PackageCheck, t: "Pedido conferido", d: "Confirmação de itens e endereço antes de sair para entrega." },
];

function Diferenciais() {
  return (
    <section className="w-full min-w-0 bg-[#F6F7F9] py-16 sm:py-20">
      <div className="mx-auto w-full min-w-0 max-w-6xl px-4">
        <SectionTitle eyebrow="Por que a Forte Gás" title="Simples, próximo e confiável" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DIFERENCIAIS.map((d) => (
            <div key={d.t} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6">
              <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#E8620C]/10 text-[#C4530A]">
                <d.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 style={{ color: "#0F2A4A" }} className="text-base font-semibold">{d.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{d.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Atendimento / Localização ---------- */
function Atendimento() {
  return (
    <section id="atendimento" className="w-full min-w-0 bg-white py-16 sm:py-20">
      <div className="mx-auto grid w-full min-w-0 max-w-6xl gap-8 px-4 lg:grid-cols-2 lg:items-center">
        <div className="min-w-0">
          <p style={{ color: "#C4530A" }} className="mb-2 text-xs font-bold uppercase tracking-[0.18em]">Onde estamos</p>
          <h2 style={{ color: "#0F2A4A" }} className="text-2xl font-bold tracking-tight sm:text-3xl">
            Área de atendimento em {LOJA.cidade}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            Atendemos residências e comércios de {LOJA.cidade} e região. Se tiver dúvida se entregamos no seu
            bairro, é só chamar no WhatsApp.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-slate-700">
            {["Pedidos por WhatsApp ou telefone", "Entrega no endereço informado", "Atendimento feito pela própria loja"].map(
              (i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#128C4A]" aria-hidden />
                  <span className="min-w-0">{i}</span>
                </li>
              ),
            )}
          </ul>
        </div>

        <address className="min-w-0 rounded-2xl border border-slate-200 bg-[#F6F7F9] p-6 not-italic">
          <h3 style={{ color: "#0F2A4A" }} className="text-base font-semibold">Endereço da loja</h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            {LOJA.endereco}
            <br />
            {LOJA.cidade} — {LOJA.estado}
          </p>
          <a
            href={MAPS_LINK}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#0F2A4A" }}
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#0F2A4A]/20 bg-white px-4 text-sm font-semibold transition-colors hover:bg-[#0F2A4A]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2A4A]"
          >
            <MapPin className="h-4 w-4" aria-hidden /> Ver no mapa
            <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
        </address>
      </div>
    </section>
  );
}

/* ---------- CTA final ---------- */
function CTAFinal() {
  return (
    <section id="contato" className="w-full min-w-0 bg-[#0F2A4A] py-16 sm:py-20">
      <div className="mx-auto w-full min-w-0 max-w-3xl px-4 text-center">
        <h2 style={{ color: "#ffffff" }} className="text-2xl font-bold tracking-tight sm:text-3xl">Acabou o gás?</h2>
        <p className="mt-3 text-base leading-relaxed text-slate-200">
          Fale agora com a Forte Gás pelo WhatsApp ou por telefone e receba o pedido no seu endereço.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <WhatsAppButton />
          <CallButton dark />
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */
function Footer() {
  return (
    <footer className="w-full min-w-0 border-t border-slate-200 bg-white py-10">
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col items-center gap-5 px-4 text-center md:flex-row md:justify-between md:text-left">
        <div className="flex min-w-0 items-center gap-3">
          <img src={forteGasLogo} alt="Forte Gás" className="h-9 w-auto" loading="lazy" width={140} height={36} />
          <span className="text-sm text-slate-600">
            {LOJA.cidade} — {LOJA.estado}
          </span>
        </div>
        <div className="min-w-0 text-sm text-slate-600">
          <a href={`tel:${LOJA.telefoneTel}`} style={{ color: "#0F2A4A" }} className="font-semibold hover:underline">
            {LOJA.telefoneExibicao}
          </a>
          <p className="mt-1 text-xs text-slate-500">
            © {new Date().getFullYear()} {LOJA.nome}. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ---------- Flutuantes ---------- */
function FloatingWhatsApp() {
  return (
    <a
      href={WHATSAPP_LINK}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Pedir pelo WhatsApp — ${LOJA.telefoneExibicao}`}
      className="fixed bottom-5 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#128C4A] text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#128C4A] motion-reduce:transition-none"
    >
      <MessageCircle className="h-7 w-7" aria-hidden />
    </a>
  );
}

function ScrollTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-5 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0F2A4A] shadow-md transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2A4A]"
      aria-label="Voltar ao topo"
    >
      <ChevronUp className="h-5 w-5" aria-hidden />
    </button>
  );
}

/* ---------- Página ---------- */
export default function ForteGas() {
  const [biaSignal] = useState(0);

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-hidden bg-white font-sans text-slate-800 antialiased">
      <Helmet>
        <title>Forte Gás — Gás P13, P45 e água em Cornélio Procópio (PR)</title>
        <meta
          name="description"
          content="Forte Gás: entrega de gás P13, P45 e água mineral em Cornélio Procópio (PR). Peça pelo WhatsApp (43) 98432-8383."
        />
        <link rel="canonical" href="https://gasfacilpro.lovable.app/fortegas" />
        <meta property="og:title" content="Forte Gás — Gás e água em Cornélio Procópio (PR)" />
        <meta
          property="og:description"
          content="Entrega de gás P13, P45 e água mineral em Cornélio Procópio (PR). Pedidos pelo WhatsApp (43) 98432-8383."
        />
        <meta property="og:url" content="https://gasfacilpro.lovable.app/fortegas" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <Navbar />
      <main>
        <Hero />
        <Produtos />
        <ComoPedir />
        <Diferenciais />
        <Atendimento />
        <CTAFinal />
      </main>
      <Footer />

      <FloatingWhatsApp />
      <ScrollTop />
      <BiaChatWidget
        unidadeSlug="fortegas"
        nomeLoja={LOJA.nome}
        gradient="from-[#0F2A4A] via-[#123863] to-[#E8620C]"
        accent="orange-500"
        openSignal={biaSignal}
        compact
        lightTheme
        launcherClassName="bottom-5 right-[5.5rem] bg-[#0F2A4A]/95"
      />
    </div>
  );
}
