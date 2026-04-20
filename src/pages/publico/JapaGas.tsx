import { useState } from "react";
import {
  Flame,
  Phone,
  Clock,
  MapPin,
  Truck,
  Shield,
  CreditCard,
  ChevronUp,
  MessageCircle,
  Droplets,
  Menu,
  X,
  AlertTriangle,
  Wind,
  CheckCircle2,
  Calendar,
  ArrowUpCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/japa-gas/hero.jpg";
import seg1 from "@/assets/japa-gas/seguranca-1.jpg";
import seg2 from "@/assets/japa-gas/seguranca-2.jpg";
import seg3 from "@/assets/japa-gas/seguranca-3.jpg";
import seg4 from "@/assets/japa-gas/seguranca-4.jpg";
import seg5 from "@/assets/japa-gas/seguranca-5.jpg";
import seg6 from "@/assets/japa-gas/seguranca-6.jpg";

const WHATSAPP_NUMBER = "5543999661816";
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=Olá! Gostaria de fazer um pedido de gás na Japa Gás.`;
const PHONE = "(43) 3524-1094";
const WHATSAPP_DISPLAY = "(43) 99966-1816";
const ENDERECO = "Cornélio Procópio, PR";

// Paleta Japa Gás
const TEAL = "#0d7377";
const TEAL_LIGHT = "#2d8a8a";
const CORAL = "#e07856";
const CORAL_DARK = "#d96846";
const WASHI = "#f4f1ea";

function Header() {
  const [open, setOpen] = useState(false);
  const links = [
    { label: "Início", href: "#inicio" },
    { label: "Sobre", href: "#sobre" },
    { label: "Serviços", href: "#servicos" },
    { label: "Segurança", href: "#seguranca" },
    { label: "Contato", href: "#contato" },
  ];
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-16">
        <a href="#inicio" className="flex items-center gap-2.5">
          <div
            className="relative w-9 h-9 rounded-full flex items-center justify-center text-white shadow-md"
            style={{ background: `linear-gradient(135deg, ${TEAL_LIGHT}, ${TEAL})` }}
          >
            <Flame className="h-5 w-5" />
            <span
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
              style={{ background: CORAL }}
            />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-lg font-bold tracking-tight" style={{ color: TEAL }}>
              Japa Gás
            </span>
            <span className="text-[10px] uppercase tracking-widest text-slate-400">
              Filial Central Gás
            </span>
          </div>
        </a>
        <nav className="hidden md:flex items-center gap-6">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-slate-600 transition-colors"
              style={{ ["--hover" as never]: CORAL }}
              onMouseEnter={(e) => (e.currentTarget.style.color = CORAL)}
              onMouseLeave={(e) => (e.currentTarget.style.color = "")}
            >
              {l.label}
            </a>
          ))}
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1.5">
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
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block py-2 text-sm font-medium text-slate-700"
            >
              {l.label}
            </a>
          ))}
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white gap-1.5 mt-2">
              <MessageCircle className="h-4 w-4" /> Pedir Agora
            </Button>
          </a>
        </div>
      )}
    </header>
  );
}

function Hero() {
  const quickActions = [
    { label: "Pronto agora", desc: "Peça e receba rápido" },
    { label: "Gás P13", desc: "Botijão residencial" },
    { label: "Entrega expressa", desc: "Em minutos na sua porta" },
  ];
  return (
    <section id="inicio" className="relative pt-16 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL_LIGHT} 50%, ${CORAL} 100%)`,
        }}
      />
      {/* Sol vermelho - motivo japonês */}
      <div
        className="absolute top-24 right-[10%] w-72 h-72 rounded-full opacity-25 blur-2xl"
        style={{ background: CORAL_DARK }}
      />
      <div
        className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full opacity-20 blur-3xl"
        style={{ background: WASHI }}
      />

      <div className="relative max-w-6xl mx-auto px-4 py-24 md:py-32 text-center text-white">
        <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-medium mb-6">
          <Sparkles className="h-4 w-4" /> Tradição e confiança · 信頼
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight mb-4">
          Energia que aquece
          <br />
          sua casa
        </h1>
        <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto mb-8">
          Gás de cozinha P13 e P45 com entrega rápida em Cornélio Procópio. Atendimento
          atencioso, segurança e qualidade — do nosso lar ao seu.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
            <Button
              size="lg"
              className="bg-green-500 hover:bg-green-600 text-white text-base gap-2 px-8 shadow-lg"
            >
              <MessageCircle className="h-5 w-5" /> Pedir pelo WhatsApp
            </Button>
          </a>
          <a href={`tel:${PHONE.replace(/\D/g, "")}`}>
            <Button
              size="lg"
              variant="outline"
              className="bg-white/10 border-white text-white hover:bg-white text-base gap-2 px-8"
              style={{ ["--hover-color" as never]: TEAL }}
              onMouseEnter={(e) => (e.currentTarget.style.color = TEAL)}
              onMouseLeave={(e) => (e.currentTarget.style.color = "")}
            >
              <Phone className="h-5 w-5" /> {PHONE}
            </Button>
          </a>
        </div>

        <div className="mt-10 grid sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
          {quickActions.map((a) => (
            <div
              key={a.label}
              className="text-left bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4"
            >
              <div className="text-sm font-bold text-white">{a.label}</div>
              <div className="text-xs text-white/80 mt-0.5">{a.desc}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent" />
    </section>
  );
}

function Sobre() {
  return (
    <section id="sobre" className="py-20 bg-white relative overflow-hidden">
      <div
        className="absolute top-10 right-10 w-24 h-24 rounded-full opacity-10"
        style={{ background: CORAL }}
      />
      <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-2 gap-10 items-center relative">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
            Sobre a <span style={{ color: TEAL }}>Japa Gás</span>
          </h2>
          <div className="w-16 h-1 mb-6 rounded-full" style={{ background: CORAL }} />
          <p className="text-lg text-slate-600 leading-relaxed">
            A <strong>Japa Gás</strong> é uma filial da rede <strong>Central Gás</strong>,
            atendendo Cornélio Procópio com a mesma qualidade, agilidade e dedicação que
            marcam nossa história. Inspirados nos valores de <em>respeito, disciplina e
            atenção aos detalhes</em>, oferecemos entrega rápida e atendimento humano para
            cada cliente.
          </p>
          <p className="mt-4 text-slate-500">
            Nosso compromisso: você nunca fica sem gás — e sempre recebe com segurança.
          </p>
        </div>
        <div className="relative rounded-2xl overflow-hidden shadow-xl">
          <img
            src={heroImg}
            alt="Cozinha aconchegante com botijão da Japa Gás"
            width={1280}
            height={768}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}

const servicos = [
  { icon: Flame, title: "Gás P13", desc: "Botijão residencial de 13kg, ideal para uso doméstico." },
  { icon: Flame, title: "Gás P45", desc: "Cilindro de 45kg para comércios e restaurantes." },
  { icon: Droplets, title: "Água Mineral", desc: "Galões de 20 litros entregues na sua porta." },
  { icon: Truck, title: "Entrega Expressa", desc: "Em minutos no seu endereço." },
];

function Servicos() {
  return (
    <section id="servicos" className="py-20" style={{ background: WASHI }}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">Nossos Serviços</h2>
          <div className="w-16 h-1 mx-auto rounded-full" style={{ background: CORAL }} />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {servicos.map((s) => (
            <div
              key={s.title}
              className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300"
            >
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                style={{ background: `${TEAL}15` }}
              >
                <s.icon className="h-6 w-6" style={{ color: TEAL }} />
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

const dicasSeguranca = [
  {
    img: seg1,
    icon: CheckCircle2,
    title: "Verifique o lacre do botijão",
    desc: "Antes de aceitar o botijão, confira se o lacre está intacto. Lacre rompido pode indicar adulteração.",
  },
  {
    img: seg2,
    icon: Wind,
    title: "Instale em área ventilada",
    desc: "Mantenha o botijão sempre em local arejado, longe de paredes fechadas e ambientes sem circulação de ar.",
  },
  {
    img: seg3,
    icon: Droplets,
    title: "Teste com água e sabão",
    desc: "Aplique água com sabão nas conexões. Se formar bolhas, há vazamento — feche o registro imediatamente.",
  },
  {
    img: seg4,
    icon: Calendar,
    title: "Mangueira e regulador na validade",
    desc: "Troque a mangueira a cada 5 anos e o regulador a cada 10. Verifique sempre a data gravada nos equipamentos.",
  },
  {
    img: seg5,
    icon: AlertTriangle,
    title: "Em caso de vazamento",
    desc: "NÃO acenda luzes, nem use celular. Abra portas e janelas, feche o registro e ligue para o 193.",
  },
  {
    img: seg6,
    icon: ArrowUpCircle,
    title: "Mantenha em pé, longe do calor",
    desc: "O botijão deve ficar sempre na vertical, longe de fogões, fornos, sol direto e fontes de calor.",
  },
];

function DicasSeguranca() {
  return (
    <section id="seguranca" className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold mb-4"
            style={{ background: `${CORAL}15`, color: CORAL_DARK }}
          >
            <Shield className="h-4 w-4" /> Sua segurança em primeiro lugar
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
            Dicas de Segurança com Gás
          </h2>
          <div className="w-16 h-1 mx-auto rounded-full" style={{ background: CORAL }} />
        </div>

        {/* Banner emergência */}
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5 mb-10 flex flex-col sm:flex-row items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="font-bold text-red-900">Em caso de emergência, ligue:</h3>
            <p className="text-sm text-red-700">
              Bombeiros e SAMU atendem 24h, gratuitamente, em todo o Brasil.
            </p>
          </div>
          <div className="flex gap-2">
            <a href="tel:193">
              <Button className="bg-red-600 hover:bg-red-700 text-white gap-1.5">
                <Phone className="h-4 w-4" /> 193 Bombeiros
              </Button>
            </a>
            <a href="tel:192">
              <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-100 gap-1.5">
                <Phone className="h-4 w-4" /> 192 SAMU
              </Button>
            </a>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {dicasSeguranca.map((d) => (
            <article
              key={d.title}
              className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                <img
                  src={d.img}
                  alt={d.title}
                  width={768}
                  height={512}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div
                  className="absolute top-3 left-3 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg"
                  style={{ background: TEAL }}
                >
                  <d.icon className="h-5 w-5" />
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-slate-800 mb-1.5">{d.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{d.desc}</p>
              </div>
            </article>
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
    <section className="py-20" style={{ background: WASHI }}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
            Por que escolher a Japa Gás?
          </h2>
          <div className="w-16 h-1 mx-auto rounded-full" style={{ background: CORAL }} />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {diferenciais.map((d) => (
            <div key={d.title} className="text-center">
              <div
                className="w-16 h-16 rounded-full text-white flex items-center justify-center mx-auto mb-4 shadow-lg"
                style={{ background: TEAL }}
              >
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
    <section id="contato" className="py-20 bg-white">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">Entre em Contato</h2>
          <div className="w-16 h-1 mx-auto rounded-full" style={{ background: CORAL }} />
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <a
            href={`tel:${PHONE.replace(/\D/g, "")}`}
            className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 text-center hover:shadow-md transition-shadow"
          >
            <Phone className="h-8 w-8 mx-auto mb-3" style={{ color: TEAL }} />
            <h3 className="font-semibold text-slate-800 mb-1">Telefone</h3>
            <p className="text-slate-600">{PHONE}</p>
          </a>
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 text-center hover:shadow-md transition-shadow"
          >
            <MessageCircle className="h-8 w-8 text-green-500 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-800 mb-1">WhatsApp</h3>
            <p className="text-slate-600">{WHATSAPP_DISPLAY}</p>
          </a>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 text-center">
            <MapPin className="h-8 w-8 mx-auto mb-3" style={{ color: CORAL }} />
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
      <div className="max-w-6xl mx-auto px-4 text-center text-sm space-y-1">
        <p>
          © {new Date().getFullYear()} <span className="text-white font-semibold">Japa Gás</span> —
          Filial Central Gás · Cornélio Procópio, PR.
        </p>
        <p className="text-xs text-slate-500">Todos os direitos reservados.</p>
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
      className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
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

export default function JapaGas() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <Hero />
      <Sobre />
      <Servicos />
      <DicasSeguranca />
      <Diferenciais />
      <Contato />
      <Footer />
      <FloatingWhatsApp />
      <ScrollTop />
    </div>
  );
}
