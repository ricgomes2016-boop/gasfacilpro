import { useState, useEffect } from "react";
import { Flame, Phone, Clock, MapPin, Truck, Shield, CreditCard, ChevronUp, MessageCircle, Droplets, Menu, X, Zap, Sparkles, ArrowRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

const WHATSAPP_NUMBER = "5543984328383";
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=Olá! Gostaria de fazer um pedido de gás na Forte Gás.`;
const PHONE_DISPLAY = "(43) 98432-8383";
const PHONE_TEL = "5543984328383";
const ENDERECO = "Rua Wilson de Barros Gatti, 10 — CL Fortunato Sibim";
const CIDADE = "Cornélio Procópio - PR";

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
          ? "bg-slate-950/85 backdrop-blur-xl border-b border-orange-500/20 shadow-[0_8px_32px_-8px_rgba(249,115,22,0.3)]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-16">
        <a href="#inicio" className="flex items-center gap-2 group">
          <div className="relative">
            <div className="absolute inset-0 bg-orange-500 blur-lg opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg">
              <Flame className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-lg font-extrabold text-white tracking-tight">FORTE</span>
            <span className="text-[10px] font-bold text-orange-400 tracking-[0.3em] -mt-0.5">GÁS</span>
          </div>
        </a>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-slate-200 hover:text-orange-400 px-3 py-2 rounded-md transition-colors relative group"
            >
              {l.label}
              <span className="absolute bottom-1 left-3 right-3 h-px bg-orange-400 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
            </a>
          ))}
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="ml-3">
            <Button size="sm" className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white gap-1.5 shadow-lg shadow-orange-500/30 border-0">
              <MessageCircle className="h-4 w-4" /> Pedir Agora
            </Button>
          </a>
        </nav>

        <button className="md:hidden p-2 text-white" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-slate-950/95 backdrop-blur-xl border-t border-orange-500/20 px-4 pb-4 space-y-1 animate-fade-in">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block py-2.5 text-sm font-medium text-slate-200 hover:text-orange-400">
              {l.label}
            </a>
          ))}
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white gap-1.5 mt-2 border-0">
              <MessageCircle className="h-4 w-4" /> Pedir Agora
            </Button>
          </a>
        </div>
      )}
    </header>
  );
}

/* ---------- Hero ---------- */
function Hero() {
  return (
    <section id="inicio" className="relative min-h-screen flex items-center pt-16 overflow-hidden bg-slate-950">
      {/* Animated gradient blobs */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />
        <div className="absolute bottom-1/4 -right-20 w-[500px] h-[500px] bg-orange-500/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "6s", animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-orange-600/10 rounded-full blur-3xl" />
      </div>

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-32 text-center text-white w-full">
        <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-md border border-orange-500/30 rounded-full px-4 py-1.5 text-xs font-semibold mb-8 animate-fade-in">
          <Sparkles className="h-3.5 w-3.5 text-orange-400" />
          <span className="bg-gradient-to-r from-orange-300 to-orange-100 bg-clip-text text-transparent">Cornélio Procópio e Região</span>
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black leading-[0.95] tracking-tighter mb-6 animate-fade-in">
          A força do gás{" "}
          <span className="relative inline-block">
            <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400 bg-clip-text text-transparent">na sua porta</span>
            <span className="absolute -inset-2 bg-orange-500/20 blur-2xl -z-10" />
          </span>
        </h1>

        <p className="text-base md:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in">
          Entrega expressa de <strong className="text-white">P13</strong>, <strong className="text-white">P45</strong> e <strong className="text-white">água mineral</strong>.
          Atendimento rápido, seguro e do jeito que sua família merece.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16 animate-fade-in">
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white text-base gap-2 px-8 h-12 shadow-xl shadow-orange-500/40 border-0 group">
              <MessageCircle className="h-5 w-5" />
              Pedir pelo WhatsApp
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </a>
          <a href={`tel:${PHONE_TEL}`}>
            <Button size="lg" variant="outline" className="border-white/20 bg-white/5 backdrop-blur text-white hover:bg-white/10 text-base gap-2 px-8 h-12">
              <Phone className="h-5 w-5 text-orange-400" /> {PHONE_DISPLAY}
            </Button>
          </a>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
          {[
            { v: "15min", l: "Entrega média" },
            { v: "100%", l: "Produtos certificados" },
            { v: "5★", l: "Atendimento" },
          ].map((s) => (
            <div key={s.l} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 hover:border-orange-500/40 hover:bg-white/[0.07] transition-all">
              <div className="text-2xl md:text-3xl font-black bg-gradient-to-br from-orange-300 to-orange-500 bg-clip-text text-transparent">{s.v}</div>
              <div className="text-[11px] md:text-xs text-slate-400 mt-1 uppercase tracking-wider">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-slate-950 to-transparent" />
    </section>
  );
}

/* ---------- Sobre ---------- */
function Sobre() {
  return (
    <section id="sobre" className="relative py-24 bg-slate-950 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-blue-950/20 to-slate-950" />
      <div className="relative max-w-5xl mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-orange-400 mb-4">
              <span className="w-8 h-px bg-orange-400" /> Sobre nós
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
              Tradição e <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">confiança</span> em cada entrega.
            </h2>
            <p className="text-base text-slate-300 leading-relaxed mb-4">
              A <strong className="text-white">Forte Gás</strong> é referência em distribuição de gás de cozinha em <strong className="text-white">Cornélio Procópio</strong> e região.
            </p>
            <p className="text-base text-slate-400 leading-relaxed">
              Levamos praticidade, segurança e atendimento ágil para sua casa ou comércio. Nossa missão é simples: você nunca ficar sem gás.
            </p>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-tr from-orange-500/30 via-blue-500/20 to-orange-400/20 blur-2xl rounded-3xl" />
            <div className="relative grid grid-cols-2 gap-3">
              {[
                { icon: Flame, label: "Gás P13", color: "from-orange-500 to-red-500" },
                { icon: Flame, label: "Gás P45", color: "from-amber-500 to-orange-600" },
                { icon: Droplets, label: "Água Mineral", color: "from-blue-400 to-blue-600" },
                { icon: Truck, label: "Entrega Expressa", color: "from-blue-500 to-indigo-600" },
              ].map((c, i) => (
                <div
                  key={c.label}
                  className="relative bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 hover:-translate-y-1 hover:border-orange-500/40 transition-all duration-500"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center shadow-lg mb-3`}>
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
  { icon: Flame, title: "Gás P13", desc: "Botijão residencial de 13kg, ideal para uso doméstico.", color: "from-orange-500 to-red-500" },
  { icon: Flame, title: "Gás P45", desc: "Cilindro de 45kg para comércios e restaurantes.", color: "from-amber-500 to-orange-600" },
  { icon: Droplets, title: "Água Mineral", desc: "Galões de 20 litros de água mineral de qualidade.", color: "from-blue-400 to-blue-600" },
  { icon: Truck, title: "Entrega Expressa", desc: "Entregamos em minutos em Cornélio Procópio.", color: "from-blue-500 to-indigo-600" },
];

function Servicos() {
  return (
    <section id="servicos" className="relative py-24 bg-gradient-to-b from-slate-950 to-slate-900 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-orange-400 mb-4">
            <span className="w-8 h-px bg-orange-400" /> O que oferecemos <span className="w-8 h-px bg-orange-400" />
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Nossos Serviços</h2>
          <p className="text-slate-400 max-w-xl mx-auto">Tudo que você precisa, com agilidade e qualidade garantidas.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {servicos.map((s, i) => (
            <div
              key={s.title}
              className="group relative bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-6 hover:-translate-y-2 hover:border-orange-500/50 transition-all duration-500"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className={`absolute -top-px left-6 right-6 h-px bg-gradient-to-r from-transparent via-orange-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                <s.icon className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Diferenciais ---------- */
const diferenciais = [
  { icon: Zap, title: "Entrega Expressa", desc: "Receba seu pedido em minutos" },
  { icon: Clock, title: "Atendimento Estendido", desc: "Pronto para atender você" },
  { icon: Shield, title: "Segurança Total", desc: "Produtos certificados e seguros" },
  { icon: CreditCard, title: "Pagamento Fácil", desc: "Dinheiro, cartão ou Pix" },
];

function Diferenciais() {
  return (
    <section id="diferenciais" className="relative py-24 bg-slate-900 overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/3 w-72 h-72 bg-orange-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/3 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-orange-400 mb-4">
            <span className="w-8 h-px bg-orange-400" /> Por que nós <span className="w-8 h-px bg-orange-400" />
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            Por que escolher a <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">Forte Gás?</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {diferenciais.map((d, i) => (
            <div
              key={d.title}
              className="group relative text-center"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="relative mb-5 inline-block">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 text-white flex items-center justify-center mx-auto shadow-xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                  <d.icon className="h-7 w-7" />
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
    <section className="relative py-20 bg-slate-950 overflow-hidden">
      <div className="max-w-5xl mx-auto px-4">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 p-10 md:p-14 text-center shadow-2xl shadow-orange-500/30">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_50%)]" />
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-500/30 rounded-full blur-3xl" />

          <div className="relative">
            <div className="inline-flex items-center gap-1.5 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-white text-white" />
              ))}
            </div>
            <h3 className="text-3xl md:text-5xl font-black text-white mb-4 leading-tight">Acabou o gás?<br className="md:hidden" /> Peça em segundos.</h3>
            <p className="text-white/90 text-lg mb-8 max-w-xl mx-auto">Entrega rápida em toda Cornélio Procópio. Atendimento humano, sem robôs.</p>
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="bg-white text-orange-600 hover:bg-orange-50 text-base font-bold gap-2 px-8 h-12 shadow-xl border-0">
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
    <section id="contato" className="relative py-24 bg-slate-950">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-orange-400 mb-4">
            <span className="w-8 h-px bg-orange-400" /> Fale conosco <span className="w-8 h-px bg-orange-400" />
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Entre em Contato</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          <a href={`tel:${PHONE_TEL}`} className="group bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/10 rounded-2xl p-7 text-center hover:-translate-y-1 hover:border-orange-500/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform">
              <Phone className="h-5 w-5 text-white" />
            </div>
            <h3 className="font-bold text-white mb-1">Telefone</h3>
            <p className="text-slate-400 text-sm">{PHONE_DISPLAY}</p>
          </a>

          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="group bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/10 rounded-2xl p-7 text-center hover:-translate-y-1 hover:border-green-500/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <h3 className="font-bold text-white mb-1">WhatsApp</h3>
            <p className="text-slate-400 text-sm">{PHONE_DISPLAY}</p>
          </a>

          <div className="group bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/10 rounded-2xl p-7 text-center hover:-translate-y-1 hover:border-blue-500/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <h3 className="font-bold text-white mb-1">Endereço</h3>
            <p className="text-slate-400 text-xs leading-relaxed">{ENDERECO}<br />{CIDADE}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */
function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-white/5 text-slate-500 py-10">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
              <Flame className="h-4 w-4 text-white" />
            </div>
            <div className="leading-none">
              <div className="text-sm font-extrabold text-white">FORTE GÁS</div>
              <div className="text-[10px] text-orange-400 font-bold tracking-widest">CORNÉLIO PROCÓPIO</div>
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
    <a
      href={WHATSAPP_LINK}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 group"
      aria-label="WhatsApp"
    >
      <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-30" />
      <span className="relative w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-green-500/40 group-hover:scale-110 transition-transform">
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
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 left-6 z-50 w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 hover:bg-orange-500 hover:border-orange-500 text-white rounded-full flex items-center justify-center shadow-lg transition-all animate-fade-in"
      aria-label="Voltar ao topo"
    >
      <ChevronUp className="h-5 w-5" />
    </button>
  );
}

export default function ForteGas() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />
      <Hero />
      <Sobre />
      <Servicos />
      <Diferenciais />
      <CTABanner />
      <Contato />
      <Footer />
      <FloatingWhatsApp />
      <ScrollTop />
    </div>
  );
}
