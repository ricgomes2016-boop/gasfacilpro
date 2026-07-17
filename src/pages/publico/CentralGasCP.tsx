import { useState } from "react";
import { Flame, Phone, Clock, MapPin, Truck, Shield, CreditCard, ChevronUp, MessageCircle, Droplets, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const WHATSAPP_NUMBER = "5543999661816";
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=Olá! Gostaria de fazer um pedido de gás.`;
const PHONE = "(43) 3524-1094";
const WHATSAPP_DISPLAY = "(43) 99966-1816";
const ENDERECO = "Rua Benjamin Constant, 110, Centro, Cornélio Procópio, PR";

function Header() {
  const [open, setOpen] = useState(false);
  const links = [
    { label: "Início", href: "#inicio" },
    { label: "Sobre", href: "#sobre" },
    { label: "Serviços", href: "#servicos" },
    { label: "Contato", href: "#contato" },
  ];
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-16">
        <a href="#inicio" className="flex items-center gap-2">
          <Flame className="h-7 w-7 text-warning" />
          <span className="text-xl font-bold text-slate-800 tracking-tight">Central Gás</span>
        </a>
        <nav className="hidden md:flex items-center gap-6">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-slate-600 hover:text-warning transition-colors">
              {l.label}
            </a>
          ))}
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="bg-success hover:bg-success text-white gap-1.5">
              <MessageCircle className="h-4 w-4" /> Pedir Agora
            </Button>
          </a>
        </nav>
        <button className="md:hidden p-2" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden bg-white border-t border-slate-100 px-4 pb-4 space-y-2">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block py-2 text-sm font-medium text-slate-700">
              {l.label}
            </a>
          ))}
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="w-full bg-success hover:bg-success text-white gap-1.5 mt-2">
              <MessageCircle className="h-4 w-4" /> Pedir Agora
            </Button>
          </a>
        </div>
      )}
    </header>
  );
}

function Hero({ onAskBia }: { onAskBia: (msg: string) => void }) {
  const quickActions = [
    { label: "Pronto agora", desc: "Peça e receba rápido", msg: "Quero gás agora!" },
    { label: "Gás P13", desc: "Botijão residencial", msg: "Quero pedir um P13" },
    { label: "Entrega expressa", desc: "Em minutos na sua porta", msg: "Preciso de entrega expressa" },
  ];
  return (
    <section id="inicio" className="relative pt-16 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-warning via-warning to-destructive" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZ2LTZoNnptMC0zMHY2aC02VjRoNnptMCAxMnY2aC02di02aDZ6bTAgMTJ2Nmgt NnYtNmg2eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
      <div className="relative max-w-6xl mx-auto px-4 py-24 md:py-36 text-center text-white">
        <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-medium mb-6">
          <Flame className="h-4 w-4" /> Cornélio Procópio e Região
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight mb-4">
          Gás de qualidade<br />na sua porta
        </h1>
        <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto mb-8">
          Entrega rápida de gás de cozinha P13, P45 e água mineral em Cornélio Procópio. Ligue ou peça pelo WhatsApp!
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="bg-success hover:bg-success text-white text-base gap-2 px-8 shadow-lg">
              <MessageCircle className="h-5 w-5" /> Pedir pelo WhatsApp
            </Button>
          </a>
          <a href={`tel:${PHONE.replace(/\D/g, "")}`}>
            <Button size="lg" variant="outline" className="bg-white/10 border-white text-white hover:bg-white hover:text-warning text-base gap-2 px-8">
              <Phone className="h-5 w-5" /> {PHONE}
            </Button>
          </a>
        </div>
        <div className="mt-12 grid sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
          {quickActions.map((a) => (
            <button
              key={a.label}
              onClick={() => onAskBia(a.msg)}
              className="group text-left bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-xl p-4 transition-all hover:-translate-y-0.5"
            >
              <div className="text-sm font-bold text-white">{a.label}</div>
              <div className="text-xs text-white/80 mt-0.5">{a.desc}</div>
              <div className="text-[10px] text-white/60 mt-2 uppercase tracking-wider group-hover:text-white/90">Falar com a Bia →</div>
            </button>
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent" />
    </section>
  );
}

function Sobre() {
  return (
    <section id="sobre" className="py-20 bg-white">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">Sobre a Central Gás</h2>
        <div className="w-16 h-1 bg-warning mx-auto mb-6 rounded-full" />
        <p className="text-lg text-slate-600 leading-relaxed">
          A <strong>Central Gás</strong> é referência em distribuição de gás de cozinha em <strong>Cornélio Procópio</strong> e região.
          Com anos de experiência no mercado, oferecemos entrega rápida, atendimento personalizado e os melhores preços.
          Nossa missão é levar praticidade e segurança ao seu lar, garantindo que você nunca fique sem gás.
        </p>
      </div>
    </section>
  );
}

const servicos = [
  { icon: Flame, title: "Gás P13", desc: "Botijão residencial de 13kg, ideal para uso doméstico. Entrega rápida na sua casa." },
  { icon: Flame, title: "Gás P45", desc: "Cilindro de 45kg para comércios, restaurantes e uso industrial leve." },
  { icon: Droplets, title: "Água Mineral", desc: "Galões de 20 litros de água mineral de qualidade para sua família." },
  { icon: Truck, title: "Entrega Expressa", desc: "Entregamos em minutos na região de Cornélio Procópio e bairros próximos." },
];

function Servicos() {
  return (
    <section id="servicos" className="py-20 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">Nossos Serviços</h2>
          <div className="w-16 h-1 bg-warning mx-auto rounded-full" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {servicos.map((s) => (
            <div key={s.title} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-lg bg-warning flex items-center justify-center mb-4">
                <s.icon className="h-6 w-6 text-warning" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">{s.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const diferenciais = [
  { icon: Truck, title: "Entrega Rápida", desc: "Receba seu pedido em minutos" },
  { icon: Clock, title: "Atendimento Estendido", desc: "Pronto para atender você" },
  { icon: Shield, title: "Segurança", desc: "Produtos certificados e seguros" },
  { icon: CreditCard, title: "Pagamento Fácil", desc: "Dinheiro, cartão ou Pix" },
];

function Diferenciais() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">Por que escolher a Central Gás?</h2>
          <div className="w-16 h-1 bg-warning mx-auto rounded-full" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {diferenciais.map((d) => (
            <div key={d.title} className="text-center">
              <div className="w-16 h-16 rounded-full bg-warning text-white flex items-center justify-center mx-auto mb-4 shadow-lg">
                <d.icon className="h-7 w-7" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-1">{d.title}</h3>
              <p className="text-sm text-slate-500">{d.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contato() {
  return (
    <section id="contato" className="py-20 bg-slate-50">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">Entre em Contato</h2>
          <div className="w-16 h-1 bg-warning mx-auto rounded-full" />
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 text-center hover:shadow-md transition-shadow">
            <Phone className="h-8 w-8 text-warning mx-auto mb-3" />
            <h3 className="font-semibold text-slate-800 mb-1">Telefone</h3>
            <p className="text-slate-600">{PHONE}</p>
          </a>
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 text-center hover:shadow-md transition-shadow">
            <MessageCircle className="h-8 w-8 text-success mx-auto mb-3" />
            <h3 className="font-semibold text-slate-800 mb-1">WhatsApp</h3>
            <p className="text-slate-600">{WHATSAPP_DISPLAY}</p>
          </a>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 text-center">
            <MapPin className="h-8 w-8 text-warning mx-auto mb-3" />
            <h3 className="font-semibold text-slate-800 mb-1">Endereço</h3>
            <p className="text-slate-600 text-sm">{ENDERECO}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 py-8">
      <div className="max-w-6xl mx-auto px-4 text-center text-sm">
        <p>© {new Date().getFullYear()} Central Gás — Cornélio Procópio, PR. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}

function FloatingWhatsApp() {
  return (
    <a
      href={WHATSAPP_LINK}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-success hover:bg-success text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
      aria-label="WhatsApp"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}

function ScrollTop() {
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 left-6 z-50 w-10 h-10 bg-slate-800 hover:bg-slate-700 text-white rounded-full flex items-center justify-center shadow-md opacity-80 hover:opacity-100 transition"
      aria-label="Voltar ao topo"
    >
      <ChevronUp className="h-5 w-5" />
    </button>
  );
}

import { BiaChatWidget } from "@/components/publico/BiaChatWidget";
import { Helmet } from "react-helmet-async";

export default function CentralGasCP() {
  const [biaState, setBiaState] = useState<{ openSignal: number; prefill: string }>({ openSignal: 0, prefill: "" });
  const askBia = (msg: string) => setBiaState((s) => ({ openSignal: s.openSignal + 1, prefill: msg }));
  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>Central Gás CP — Entrega de gás P13, P45 e água em Cornélio Procópio</title>
        <meta name="description" content="Central Gás: entrega rápida de gás de cozinha P13, P45 e água mineral em Cornélio Procópio (PR). Peça pelo WhatsApp (43) 99966-1816." />
        <link rel="canonical" href="https://gasfacilpro.lovable.app/centralgascp" />
        <meta property="og:title" content="Central Gás CP — Gás e água em Cornélio Procópio" />
        <meta property="og:description" content="Entrega rápida de gás P13, P45 e água mineral em Cornélio Procópio (PR)." />
        <meta property="og:url" content="https://gasfacilpro.lovable.app/centralgascp" />
        <meta property="og:image" content="https://gasfacilpro.lovable.app/og-image.png" />
        <meta property="og:type" content="website" />
      </Helmet>
      <Header />
      <Hero onAskBia={askBia} />
      <Sobre />
      <Servicos />
      <Diferenciais />
      <Contato />
      <Footer />
      <FloatingWhatsApp />
      <ScrollTop />
      <BiaChatWidget
        unidadeSlug="centralgascp"
        nomeLoja="Central Gás"
        gradient="from-info via-info to-success"
        accent="blue-500"
        openSignal={biaState.openSignal}
        prefilledMessage={biaState.prefill}
      />
    </div>
  );
}
