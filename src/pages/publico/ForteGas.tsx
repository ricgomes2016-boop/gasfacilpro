import { useState, useEffect } from "react";
import {
  Flame, Phone, Clock, MapPin, Truck, Shield, CreditCard, ChevronUp,
  MessageCircle, Droplets, Menu, X, Zap, Sparkles, ArrowRight, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Helmet } from "react-helmet-async";
import forteGasLogo from "@/assets/forte-gas-logo.png";
import heroArt from "@/assets/forte-gas-hero-art.png";

const WHATSAPP_NUMBER = "5543984328383";
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=Olá! Gostaria de fazer um pedido de gás na Forte Gás.`;
const PHONE_DISPLAY = "(43) 98432-8383";
const PHONE_TEL = "5543984328383";
const ENDERECO = "Rua Wilson de Barros Gatti, 10 — CL Fortunato Sibim";
const CIDADE = "Cornélio Procópio - PR";

/* ---------- Reusable: Watercolor blobs background ---------- */
function FluidBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full blur-[120px] opacity-60"
        style={{ background: "radial-gradient(circle, #2fc2b5 0%, transparent 70%)" }} />
      <div className="absolute top-1/3 -right-32 w-[600px] h-[600px] rounded-full blur-[140px] opacity-50"
        style={{ background: "radial-gradient(circle, #d946ef 0%, transparent 70%)" }} />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] rounded-full blur-[130px] opacity-40"
        style={{ background: "radial-gradient(circle, #14b8a6 0%, transparent 70%)" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full blur-[100px] opacity-30"
        style={{ background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)" }} />
    </div>
  );
}

/* ---------- Header ---------- */
function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "Início", href: "#inicio" },
    { label: "Sobre", href: "#sobre" },
    { label: "Serviços", href: "#servicos" },
    { label: "Diferenciais", href: "#diferenciais" },
    { label: "Contato", href: "#contato" },
  ];

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#0a0118]/80 backdrop-blur-2xl border-b border-primary/20 shadow-[0_8px_40px_-8px_rgba(217,70,239,0.4)]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-16">
        <a href="#inicio" className="flex items-center gap-2 group">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-success/40 via-primary/40 to-primary/40 blur-2xl opacity-60 group-hover:opacity-100 transition-opacity rounded-full" />
            <img
              src={forteGasLogo}
              alt="Forte Gás"
              className="relative h-11 md:h-12 w-auto drop-shadow-[0_4px_20px_rgba(47,194,181,0.6)]"
              style={{ mixBlendMode: "screen" }}
            />
          </div>
        </a>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <a key={l.href} href={l.href}
              className="text-sm font-medium text-slate-200 hover:text-white px-3 py-2 rounded-md transition-colors relative group">
              {l.label}
              <span className="absolute bottom-1 left-3 right-3 h-px bg-gradient-to-r from-success via-primary to-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
            </a>
          ))}
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="ml-3">
            <Button size="sm" className="relative overflow-hidden bg-gradient-to-r from-success via-primary to-primary hover:opacity-90 text-white gap-1.5 shadow-lg shadow-fuchsia-500/40 border-0">
              <MessageCircle className="h-4 w-4" /> Pedir Agora
            </Button>
          </a>
        </nav>

        <button className="md:hidden p-2 text-white" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-[#0a0118]/95 backdrop-blur-2xl border-t border-primary/20 px-4 pb-4 space-y-1 animate-fade-in">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}
              className="block py-2.5 text-sm font-medium text-slate-200 hover:text-primary">
              {l.label}
            </a>
          ))}
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="w-full bg-gradient-to-r from-success via-primary to-primary text-white gap-1.5 mt-2 border-0">
              <MessageCircle className="h-4 w-4" /> Pedir Agora
            </Button>
          </a>
        </div>
      )}
    </header>
  );
}

/* ---------- Hero ---------- */
function Hero({ onAskBia }: { onAskBia: (msg: string) => void }) {
  return (
    <section id="inicio" className="relative min-h-screen flex items-center pt-24 pb-12 overflow-hidden bg-[#0a0118]">
      <FluidBackdrop />

      {/* Grid texture */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }} />

      <div className="relative max-w-6xl mx-auto px-4 w-full grid lg:grid-cols-2 gap-8 items-center">
        {/* Left: Copy */}
        <div className="text-white text-center lg:text-left order-2 lg:order-1">
          <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-md border border-primary/30 rounded-full px-4 py-1.5 text-xs font-semibold mb-6 animate-fade-in">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="bg-gradient-to-r from-success via-primary to-primary bg-clip-text text-transparent">
              Cornélio Procópio • PR
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-black leading-[0.92] tracking-tighter mb-6 animate-fade-in">
            <span className="block">A força do</span>
            <span className="block">
              gás na sua{" "}
              <span className="relative inline-block italic font-serif font-normal">
                <span className="bg-gradient-to-r from-success via-primary to-primary bg-clip-text text-transparent">porta</span>
                <svg className="absolute -bottom-3 left-0 w-full" viewBox="0 0 200 12" fill="none" preserveAspectRatio="none">
                  <path d="M2 8 Q 50 2, 100 6 T 198 5" stroke="url(#g1)" strokeWidth="3" strokeLinecap="round" fill="none" />
                  <defs>
                    <linearGradient id="g1">
                      <stop offset="0%" stopColor="#2fc2b5" />
                      <stop offset="50%" stopColor="#e879f9" />
                      <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </span>
          </h1>

          <p className="text-base md:text-lg text-slate-300 max-w-xl mx-auto lg:mx-0 mb-10 leading-relaxed animate-fade-in">
            Entrega expressa de <strong className="text-white">P13</strong>, <strong className="text-white">P45</strong> e{" "}
            <strong className="text-white">água mineral</strong>. Atendimento rápido, seguro e do jeito que sua família merece.
          </p>

          <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3 mb-12 animate-fade-in">
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="relative overflow-hidden group bg-gradient-to-r from-success via-primary to-primary hover:opacity-90 text-white text-base gap-2 px-8 h-13 shadow-2xl shadow-fuchsia-500/40 border-0">
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <MessageCircle className="h-5 w-5 relative" />
                <span className="relative">Pedir pelo WhatsApp</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform relative" />
              </Button>
            </a>
            <a href={`tel:${PHONE_TEL}`}>
              <Button size="lg" variant="outline" className="border-white/20 bg-white/5 backdrop-blur text-white hover:bg-white/10 hover:text-white text-base gap-2 px-8 h-13">
                <Phone className="h-5 w-5 text-primary" /> {PHONE_DISPLAY}
              </Button>
            </a>
          </div>

          {/* Quick action cards (antes flutuantes na arte) */}
          <div className="grid sm:grid-cols-2 gap-3 max-w-xl mx-auto lg:mx-0 mb-12 animate-fade-in">
            <button
              type="button"
              onClick={() => onAskBia("Quero pedir um P13 agora!")}
              className="bg-white/10 backdrop-blur-xl border border-white/20 hover:border-primary/60 hover:bg-white/[0.18] rounded-2xl p-3 shadow-xl transition-all hover:-translate-y-0.5 hover:scale-[1.02] group cursor-pointer text-left"
              aria-label="Pedir P13 com a Bia"
            >
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-success to-primary flex items-center justify-center shadow-lg shadow-fuchsia-500/30 shrink-0">
                  <Flame className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-300 uppercase tracking-wider flex items-center gap-1">
                    Pronto agora <Sparkles className="h-2.5 w-2.5 text-primary" />
                  </div>
                  <div className="text-xs font-bold text-white group-hover:text-primary transition-colors">Pedir P13 → Bia</div>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => onAskBia("Preciso de entrega expressa, por favor!")}
              className="bg-white/10 backdrop-blur-xl border border-white/20 hover:border-primary/60 hover:bg-white/[0.18] rounded-2xl p-3 shadow-xl transition-all hover:-translate-y-0.5 hover:scale-[1.02] group cursor-pointer text-left"
              aria-label="Pedir entrega expressa com a Bia"
            >
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-success to-primary flex items-center justify-center shadow-lg shadow-purple-500/30 shrink-0">
                  <Truck className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-300 uppercase tracking-wider flex items-center gap-1">
                    Entrega <Sparkles className="h-2.5 w-2.5 text-primary" />
                  </div>
                  <div className="text-xs font-bold text-white group-hover:text-primary transition-colors">Expressa → Bia</div>
                </div>
              </div>
            </button>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-3 gap-3 max-w-xl mx-auto lg:mx-0">
            {[
              { v: "20min", l: "Entrega média" },
              { v: "100%", l: "Certificado" },
              { v: "5★", l: "Atendimento" },
            ].map((s) => (
              <div key={s.l} className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-3 md:p-4 hover:border-primary/40 hover:bg-white/[0.07] transition-all">
                <div className="text-2xl md:text-3xl font-black bg-gradient-to-br from-success via-primary to-primary bg-clip-text text-transparent">
                  {s.v}
                </div>
                <div className="text-[10px] md:text-xs text-slate-400 mt-1 uppercase tracking-wider">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Hero art */}
        <div className="relative order-1 lg:order-2 flex justify-center items-center">
          <div className="relative w-full max-w-md lg:max-w-lg aspect-square">
            <div className="absolute inset-0 bg-gradient-to-tr from-success/30 via-primary/30 to-primary/30 blur-3xl rounded-full animate-pulse" style={{ animationDuration: "5s" }} />
            <img
              src={heroArt}
              alt="Chama abstrata Forte Gás"
              className="relative w-full h-full object-contain drop-shadow-[0_20px_60px_rgba(217,70,239,0.4)] animate-fade-in"
              style={{ animationDuration: "1.2s" }}
            />
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-[#0a0118] to-transparent" />
    </section>
  );
}

/* ---------- Sobre ---------- */
function Sobre() {
  const cards = [
    { icon: Flame, label: "Gás P13", grad: "from-success to-secondary" },
    { icon: Flame, label: "Gás P45", grad: "from-warning to-primary" },
    { icon: Droplets, label: "Água Mineral", grad: "from-success to-info" },
    { icon: Truck, label: "Entrega Expressa", grad: "from-primary to-primary" },
  ];
  return (
    <section id="sobre" className="relative py-28 bg-[#0a0118] overflow-hidden">
      <FluidBackdrop />
      <div className="relative max-w-6xl mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-14 items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-primary mb-5">
              <span className="w-10 h-px bg-gradient-to-r from-transparent to-primary" /> Sobre nós
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-[1.05] tracking-tight">
              Tradição e{" "}
              <span className="italic font-serif font-normal bg-gradient-to-r from-success via-primary to-primary bg-clip-text text-transparent">
                confiança
              </span>{" "}
              em cada entrega.
            </h2>
            <p className="text-base md:text-lg text-slate-300 leading-relaxed mb-4">
              A <strong className="text-white">Forte Gás</strong> é referência em distribuição de gás de cozinha em{" "}
              <strong className="text-white">Cornélio Procópio</strong> e região.
            </p>
            <p className="text-base text-slate-400 leading-relaxed">
              Levamos praticidade, segurança e atendimento ágil para sua casa ou comércio. Nossa missão é simples: você nunca ficar sem gás.
            </p>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 bg-gradient-to-tr from-success/20 via-primary/30 to-primary/20 blur-3xl rounded-[3rem]" />
            <div className="relative grid grid-cols-2 gap-4">
              {cards.map((c, i) => (
                <div key={c.label}
                  className={`relative bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-3xl p-6 hover:-translate-y-2 hover:border-primary/40 transition-all duration-500 ${i % 2 === 1 ? "translate-y-6" : ""}`}>
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${c.grad} flex items-center justify-center shadow-xl mb-4`}>
                    <c.icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-sm font-bold text-white">{c.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Serviços ---------- */
const servicos = [
  { icon: Flame, title: "Gás P13", desc: "Botijão residencial de 13kg, ideal para uso doméstico.", grad: "from-success to-secondary" },
  { icon: Flame, title: "Gás P45", desc: "Cilindro de 45kg para comércios e restaurantes.", grad: "from-warning to-primary" },
  { icon: Droplets, title: "Água Mineral", desc: "Galões de 20 litros de água mineral de qualidade.", grad: "from-success to-info" },
  { icon: Truck, title: "Entrega Expressa", desc: "Entregamos em minutos em Cornélio Procópio.", grad: "from-primary to-primary" },
];

function Servicos() {
  return (
    <section id="servicos" className="relative py-28 bg-gradient-to-b from-[#0a0118] via-[#1a0533] to-[#0a0118] overflow-hidden">
      <div className="absolute top-1/4 -right-32 w-[400px] h-[400px] rounded-full blur-[120px] opacity-40"
        style={{ background: "radial-gradient(circle, #2fc2b5 0%, transparent 70%)" }} />
      <div className="absolute bottom-1/4 -left-32 w-[400px] h-[400px] rounded-full blur-[120px] opacity-40"
        style={{ background: "radial-gradient(circle, #14b8a6 0%, transparent 70%)" }} />

      <div className="relative max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-primary mb-4">
            <span className="w-8 h-px bg-primary" /> O que oferecemos <span className="w-8 h-px bg-primary" />
          </div>
          <h2 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
            Nossos{" "}
            <span className="italic font-serif font-normal bg-gradient-to-r from-success via-primary to-primary bg-clip-text text-transparent">
              Serviços
            </span>
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">Tudo que você precisa, com agilidade e qualidade garantidas.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {servicos.map((s, i) => (
            <div key={s.title}
              className="group relative bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-md border border-white/10 rounded-3xl p-7 hover:-translate-y-2 hover:border-primary/50 transition-all duration-500 overflow-hidden">
              {/* Big number watermark */}
              <div className="absolute -top-6 -right-2 text-7xl font-black text-white/[0.04] select-none pointer-events-none">
                {String(i + 1).padStart(2, "0")}
              </div>
              {/* Glow on hover */}
              <div className={`absolute -top-px left-6 right-6 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className={`absolute -inset-1 bg-gradient-to-br ${s.grad} opacity-0 group-hover:opacity-10 blur-2xl transition-opacity rounded-3xl`} />

              <div className="relative">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${s.grad} flex items-center justify-center mb-5 shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500`}>
                  <s.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Diferenciais ---------- */
const diferenciais = [
  { icon: Zap, title: "Entrega Expressa", desc: "Receba seu pedido em minutos", grad: "from-success to-primary" },
  { icon: Clock, title: "Atendimento Estendido", desc: "Pronto para atender você", grad: "from-primary to-primary" },
  { icon: Shield, title: "Segurança Total", desc: "Produtos certificados e seguros", grad: "from-success to-info" },
  { icon: CreditCard, title: "Pagamento Fácil", desc: "Dinheiro, cartão ou Pix", grad: "from-primary to-primary" },
];

function Diferenciais() {
  return (
    <section id="diferenciais" className="relative py-28 bg-[#0a0118] overflow-hidden">
      <FluidBackdrop />
      <div className="relative max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-primary mb-4">
            <span className="w-8 h-px bg-primary" /> Por que nós <span className="w-8 h-px bg-primary" />
          </div>
          <h2 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
            Por que escolher a{" "}
            <span className="italic font-serif font-normal bg-gradient-to-r from-success via-primary to-primary bg-clip-text text-transparent">
              Forte Gás?
            </span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {diferenciais.map((d, i) => (
            <div key={d.title}
              className={`group relative text-center ${i % 2 === 1 ? "lg:translate-y-8" : ""}`}>
              <div className="relative mb-5 inline-block">
                <div className={`absolute inset-0 bg-gradient-to-br ${d.grad} rounded-3xl blur-2xl opacity-50 group-hover:opacity-100 transition-opacity`} />
                <div className={`relative w-20 h-20 rounded-3xl bg-gradient-to-br ${d.grad} text-white flex items-center justify-center mx-auto shadow-2xl group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500`}>
                  <d.icon className="h-8 w-8" />
                </div>
              </div>
              <h3 className="font-bold text-white text-lg mb-1">{d.title}</h3>
              <p className="text-sm text-slate-400">{d.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- CTA Banner ---------- */
function CTABanner() {
  return (
    <section className="relative py-20 bg-[#0a0118] overflow-hidden">
      <div className="max-w-5xl mx-auto px-4">
        <div className="relative rounded-[2.5rem] overflow-hidden p-10 md:p-16 text-center shadow-2xl"
          style={{
            background: "linear-gradient(135deg, #2fc2b5 0%, #6c63ff 50%, #8b5cf6 100%)",
            boxShadow: "0 40px 100px -20px rgba(217,70,239,0.5)",
          }}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.3),transparent_50%)]" />
          <div className="absolute -top-32 -right-32 w-80 h-80 bg-white/15 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-primary/40 rounded-full blur-3xl" />
          <div className="absolute top-10 left-10 w-32 h-32 rounded-full blur-2xl opacity-60"
            style={{ background: "radial-gradient(circle, #fef3c7 0%, transparent 70%)" }} />

          <div className="relative">
            <div className="inline-flex items-center gap-1.5 mb-5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current text-primary-foreground" />
              ))}
            </div>
            <h3 className="text-4xl md:text-6xl font-black text-white mb-5 leading-[1.05] tracking-tight">
              Acabou o gás?
              <br />
              <span className="italic font-serif font-normal">Peça em segundos.</span>
            </h3>
            <p className="text-white/90 text-lg mb-8 max-w-xl mx-auto">
              Entrega rápida em toda Cornélio Procópio. Atendimento humano, sem robôs.
            </p>
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="bg-white text-primary hover:bg-white/95 text-base font-bold gap-2 px-10 h-13 shadow-2xl border-0">
                <MessageCircle className="h-5 w-5" /> Pedir Agora pelo WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Contato ---------- */
function Contato() {
  return (
    <section id="contato" className="relative py-28 bg-[#0a0118] overflow-hidden">
      <FluidBackdrop />
      <div className="relative max-w-5xl mx-auto px-4">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-primary mb-4">
            <span className="w-8 h-px bg-primary" /> Fale conosco <span className="w-8 h-px bg-primary" />
          </div>
          <h2 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
            Entre em{" "}
            <span className="italic font-serif font-normal bg-gradient-to-r from-success via-primary to-primary bg-clip-text text-transparent">
              Contato
            </span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {[
            { href: `tel:${PHONE_TEL}`, ext: false, icon: Phone, title: "Telefone", desc: PHONE_DISPLAY, grad: "from-success to-primary", border: "hover:border-success/50" },
            { href: WHATSAPP_LINK, ext: true, icon: MessageCircle, title: "WhatsApp", desc: PHONE_DISPLAY, grad: "from-success to-success", border: "hover:border-success/50" },
            { href: null, ext: false, icon: MapPin, title: "Endereço", desc: `${ENDERECO}\n${CIDADE}`, grad: "from-primary to-primary", border: "hover:border-primary/50" },
          ].map((c) => {
            const inner = (
              <div className={`group relative bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-md border border-white/10 rounded-3xl p-7 text-center hover:-translate-y-1 ${c.border} transition-all h-full`}>
                <div className={`absolute -inset-px bg-gradient-to-br ${c.grad} opacity-0 group-hover:opacity-20 blur-xl transition-opacity rounded-3xl`} />
                <div className="relative">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${c.grad} flex items-center justify-center mx-auto mb-4 shadow-xl group-hover:scale-110 transition-transform`}>
                    <c.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-bold text-white mb-1">{c.title}</h3>
                  <p className="text-slate-400 text-xs leading-relaxed whitespace-pre-line">{c.desc}</p>
                </div>
              </div>
            );
            return c.href ? (
              <a key={c.title} href={c.href} {...(c.ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {inner}
              </a>
            ) : (
              <div key={c.title}>{inner}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */
function Footer() {
  return (
    <footer className="relative bg-[#0a0118] border-t border-white/5 text-slate-500 py-12 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={forteGasLogo} alt="Forte Gás" className="h-10 w-auto" />
            <div className="leading-none border-l border-white/10 pl-3">
              <div className="text-[10px] bg-gradient-to-r from-success via-primary to-primary bg-clip-text text-transparent font-bold tracking-[0.25em]">
                CORNÉLIO PROCÓPIO • PR
              </div>
              <div className="text-xs text-slate-500 mt-1">A força do gás na sua porta</div>
            </div>
          </div>
          <p className="text-xs text-center">© {new Date().getFullYear()} Forte Gás. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}

/* ---------- Floating ---------- */
function FloatingWhatsApp() {
  return (
    <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 group" aria-label="WhatsApp">
      <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-30" />
      <span className="relative w-14 h-14 bg-gradient-to-br from-success to-success text-white rounded-full flex items-center justify-center shadow-xl shadow-green-500/40 group-hover:scale-110 transition-transform">
        <MessageCircle className="h-7 w-7" />
      </span>
    </a>
  );
}

function ScrollTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 left-6 z-50 w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 hover:bg-gradient-to-br hover:from-success hover:to-secondary hover:border-primary text-white rounded-full flex items-center justify-center shadow-lg transition-all animate-fade-in"
      aria-label="Voltar ao topo">
      <ChevronUp className="h-5 w-5" />
    </button>
  );
}

import { BiaChatWidget } from "@/components/publico/BiaChatWidget";

export default function ForteGas() {
  const [biaSignal, setBiaSignal] = useState(0);
  const [biaPrefill, setBiaPrefill] = useState<string | undefined>(undefined);

  const askBia = (msg: string) => {
    setBiaPrefill(msg);
    setBiaSignal((n) => n + 1);
  };

  return (
    <div className="min-h-screen bg-[#0a0118] text-white">
      <Helmet>
        <title>Forte Gás — Entrega de gás em Cornélio Procópio (PR)</title>
        <meta name="description" content="Forte Gás: entrega rápida de gás de cozinha em Cornélio Procópio (PR). Peça pelo WhatsApp (43) 98432-8383." />
        <link rel="canonical" href="https://gasfacilpro.lovable.app/fortegas" />
        <meta property="og:title" content="Forte Gás — Gás rápido em Cornélio Procópio" />
        <meta property="og:description" content="Entrega rápida de gás de cozinha em Cornélio Procópio (PR)." />
        <meta property="og:url" content="https://gasfacilpro.lovable.app/fortegas" />
        <meta property="og:image" content="https://gasfacilpro.lovable.app/og-image.png" />
        <meta property="og:type" content="website" />
      </Helmet>
      <Header />
      <Hero onAskBia={askBia} />
      <Sobre />
      <Servicos />
      <Diferenciais />
      <CTABanner />
      <Contato />
      <Footer />
      <FloatingWhatsApp />
      <ScrollTop />
      <BiaChatWidget
        unidadeSlug="fortegas"
        nomeLoja="Forte Gás"
        gradient="from-primary via-primary to-secondary"
        accent="fuchsia-500"
        openSignal={biaSignal}
        prefilledMessage={biaPrefill}
      />
    </div>
  );
}
