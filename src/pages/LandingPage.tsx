import { useState, useEffect, useRef } from "react";
import {
  Flame, ChevronDown, ChevronUp, Truck, ShoppingCart, BarChart3,
  Users, Wallet, Package, Star, MessageCircle, Phone, Mail, MapPin,
  Check, ArrowRight, Shield, Zap, Globe, Play, Smartphone, ChevronRight,
  TrendingUp, Clock, Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, useInView } from "framer-motion";
import logoImg from "@/assets/logo.png";
import heroImg from "@/assets/landing/hero-delivery.jpg";
import dashboardImg from "@/assets/landing/dashboard-tablet.jpg";
import entregadorImg from "@/assets/landing/entregador-app.jpg";

const APP_URL = "https://app.gasfacilpro.com.br";
const WHATSAPP_URL = "https://wa.me/5543991521029?text=Olá! Gostaria de saber mais sobre o Gás Fácil Pro.";

const stats = [
  { value: "500+", label: "Revendas ativas", icon: TrendingUp },
  { value: "98%", label: "Satisfação", icon: Award },
  { value: "40%", label: "Menos tempo no acerto", icon: Clock },
  { value: "24/7", label: "Sistema disponível", icon: Zap },
];

const features = [
  { icon: ShoppingCart, title: "PDV & Vendas", desc: "Ponto de venda ágil com pedidos por WhatsApp, telefone e app do cliente.", color: "from-emerald-500/20 to-teal-500/20" },
  { icon: Truck, title: "Entregas & Logística", desc: "App do entregador com GPS, rotas otimizadas e rastreamento em tempo real.", color: "from-blue-500/20 to-cyan-500/20" },
  { icon: Package, title: "Estoque Inteligente", desc: "Controle de cilindros, comodatos e transferências entre filiais.", color: "from-amber-500/20 to-orange-500/20" },
  { icon: Wallet, title: "Financeiro Completo", desc: "Contas a pagar/receber, fluxo de caixa e conciliação bancária.", color: "from-violet-500/20 to-purple-500/20" },
  { icon: Users, title: "RH & Comissões", desc: "Folha de pagamento, ponto eletrônico e comissões automáticas.", color: "from-pink-500/20 to-rose-500/20" },
  { icon: BarChart3, title: "Dashboards & IA", desc: "Insights com inteligência artificial e indicadores em tempo real.", color: "from-cyan-500/20 to-sky-500/20" },
  { icon: Shield, title: "Fiscal & Compliance", desc: "Emissão de NF-e, NFC-e, CT-e e MDF-e integrada ao sistema.", color: "from-green-500/20 to-emerald-500/20" },
  { icon: Globe, title: "Multi-unidades", desc: "Gerencie várias filiais com visão consolidada e permissões.", color: "from-indigo-500/20 to-blue-500/20" },
];

const plans = [
  {
    name: "Básico",
    desc: "Ideal para revendas iniciantes",
    highlight: false,
    features: ["5 usuários por unidade", "Vendas e Estoque", "Entregas e Caixa", "Relatórios essenciais", "App do Entregador", "App do Cliente"],
  },
  {
    name: "Standard",
    desc: "Para revendas em crescimento",
    highlight: true,
    features: ["10 usuários por unidade", "Tudo do Básico", "Financeiro completo", "RH e Comissões", "Assistente IA", "Dashboards avançados"],
  },
  {
    name: "Enterprise",
    desc: "Operação completa e escalável",
    highlight: false,
    features: ["20+ usuários por unidade", "Tudo do Standard", "Fiscal (NF-e, CT-e)", "Frota completa", "API e Integrações", "Suporte prioritário"],
  },
];

const testimonials = [
  { name: "Carlos Mendes", role: "Proprietário — Central Gás", text: "Depois do Gás Fácil, reduzi em 40% o tempo de acerto com entregadores. O controle financeiro ficou impecável.", stars: 5 },
  { name: "Ana Souza", role: "Gestora — Forte Gás", text: "O app do entregador mudou nosso jogo. Rastreamento em tempo real e os clientes adoram acompanhar a entrega.", stars: 5 },
  { name: "Roberto Lima", role: "Diretor — Morumbi Gás", text: "Gerenciar 3 unidades era um caos. Com o painel multi-unidades, tenho tudo consolidado em um só lugar.", stars: 5 },
];

const faqs = [
  { q: "Preciso instalar algum aplicativo?", a: "Não! O Gás Fácil é um sistema 100% web (PWA). Funciona direto no navegador do celular ou computador, sem precisar baixar nada na loja de apps." },
  { q: "Como funciona a contratação?", a: "Entre em contato conosco pelo WhatsApp ou e-mail. Nossa equipe vai entender sua operação e montar o plano ideal para sua revenda." },
  { q: "Funciona para múltiplas filiais?", a: "Sim! O sistema suporta múltiplas unidades com dados consolidados, permissões individuais e transferência de estoque entre filiais." },
  { q: "Como funciona o app do entregador?", a: "O entregador acessa pelo celular, recebe os pedidos em tempo real, tem rota otimizada por GPS e faz o acerto financeiro direto no app." },
  { q: "Vocês emitem nota fiscal?", a: "Sim! No plano Enterprise, você emite NF-e, NFC-e, CT-e e MDF-e diretamente pelo sistema, com integração automática." },
  { q: "Qual o suporte oferecido?", a: "Todos os planos incluem suporte por chat e e-mail. O plano Enterprise tem suporte prioritário com atendimento dedicado." },
];

function AnimatedSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ─── Header ─── */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-background/90 backdrop-blur-xl border-b border-border/50 shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16 lg:h-18">
          <div className="flex items-center gap-2.5">
            <img src={logoImg} alt="Gás Fácil" className="h-9 w-9 object-contain" />
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-tight text-foreground tracking-tight">Gás Fácil</span>
              <span className="text-[9px] font-semibold text-primary/60 uppercase tracking-[0.2em]">ERP Pro</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#funcionalidades" className="hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#como-funciona" className="hover:text-foreground transition-colors">Como funciona</a>
            <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
            <a href="#depoimentos" className="hover:text-foreground transition-colors">Depoimentos</a>
          </nav>
          <div className="flex items-center gap-3">
            <a href={`${APP_URL}/auth`}>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">Entrar</Button>
            </a>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="gap-1.5 shadow-lg shadow-primary/20">
                Fale conosco <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Background image + overlay */}
        <div className="absolute inset-0">
          <img src={heroImg} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-32 relative z-10 w-full">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
            >
              <Badge variant="secondary" className="mb-6 text-sm px-4 py-1.5 bg-primary/10 text-primary border-primary/20">
                <Zap className="h-3.5 w-3.5 mr-1.5" /> Sistema #1 para revendas de gás
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05]"
            >
              Sua revenda no
              <br />
              <span className="text-primary">próximo nível</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.35 }}
              className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-lg"
            >
              Do pedido à entrega — vendas, logística, financeiro e muito mais em um só sistema inteligente.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="mt-10 flex flex-col sm:flex-row items-start gap-4"
            >
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="text-base px-8 h-13 gap-2.5 shadow-xl shadow-primary/30 rounded-xl">
                  <MessageCircle className="h-5 w-5" />
                  Fale com um consultor
                </Button>
              </a>
              <a href="#funcionalidades">
                <Button variant="outline" size="lg" className="text-base px-8 h-13 rounded-xl bg-background/50 backdrop-blur">
                  Conhecer o sistema
                </Button>
              </a>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="mt-5 text-xs text-muted-foreground/70"
            >
              ✓ Sem instalação &nbsp; ✓ Suporte dedicado &nbsp; ✓ Setup assistido
            </motion.p>
          </div>
        </div>
      </section>

      {/* ─── Stats Ribbon ─── */}
      <section className="relative -mt-16 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <AnimatedSection>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((s) => (
                <Card key={s.label} className="border-border/50 bg-card/80 backdrop-blur-lg shadow-lg">
                  <CardContent className="p-5 text-center">
                    <s.icon className="h-5 w-5 text-primary mx-auto mb-2" />
                    <p className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ─── Funcionalidades ─── */}
      <section id="funcionalidades" className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <AnimatedSection className="text-center mb-16">
            <Badge variant="outline" className="mb-4 text-xs px-3 py-1">Módulos</Badge>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Tudo que sua revenda precisa</h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
              Módulos integrados que cobrem cada área do seu negócio — do balcão à gestão estratégica.
            </p>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <AnimatedSection key={f.title} delay={i * 0.06}>
                <Card className="group relative overflow-hidden border-border/40 hover:border-primary/30 hover:shadow-xl transition-all duration-500 h-full">
                  <div className={`absolute inset-0 bg-gradient-to-br ${f.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <CardContent className="p-6 relative">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                      <f.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-bold text-base mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Como funciona ─── */}
      <section id="como-funciona" className="py-24 md:py-32 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Row 1: Dashboard */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-24">
            <AnimatedSection>
              <Badge variant="outline" className="mb-4 text-xs px-3 py-1">Gestão inteligente</Badge>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
                Dashboards que mostram o que importa
              </h2>
              <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
                Indicadores em tempo real, alertas inteligentes e assistente IA que analisa seus dados e sugere ações para aumentar suas vendas.
              </p>
              <ul className="mt-8 space-y-3">
                {["Visão consolidada multi-unidades", "Alertas de estoque e recompra", "Relatórios gerenciais automatizados"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </AnimatedSection>
            <AnimatedSection delay={0.15}>
              <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-primary/10 group">
                <img src={dashboardImg} alt="Dashboard do Gás Fácil" className="w-full h-auto group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
              </div>
            </AnimatedSection>
          </div>

          {/* Row 2: Entregador App */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <AnimatedSection delay={0.15} className="order-2 lg:order-1">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-primary/10 group max-w-md mx-auto">
                <img src={entregadorImg} alt="App do Entregador" className="w-full h-auto group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
              </div>
            </AnimatedSection>
            <AnimatedSection className="order-1 lg:order-2">
              <Badge variant="outline" className="mb-4 text-xs px-3 py-1">App do Entregador</Badge>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
                Entregadores conectados em tempo real
              </h2>
              <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
                Seus entregadores recebem pedidos no celular, otimizam rotas e fazem acerto financeiro — tudo pelo app.
              </p>
              <ul className="mt-8 space-y-3">
                {["GPS e rotas otimizadas", "Acerto financeiro digital", "Rastreamento para o cliente"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ─── Planos ─── */}
      <section id="planos" className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <AnimatedSection className="text-center mb-16">
            <Badge variant="outline" className="mb-4 text-xs px-3 py-1">Planos</Badge>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">O plano certo para sua operação</h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
              Cada revenda é única. Fale com nossa equipe e encontre o plano ideal para o seu negócio.
            </p>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <AnimatedSection key={plan.name} delay={i * 0.1}>
                <Card
                  className={`relative overflow-hidden transition-all duration-500 h-full ${
                    plan.highlight
                      ? "border-primary/50 shadow-xl shadow-primary/10 scale-[1.02] ring-1 ring-primary/20"
                      : "border-border/40 hover:shadow-lg hover:border-primary/20"
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary/60" />
                  )}
                  <CardContent className="p-8 flex flex-col h-full">
                    {plan.highlight && (
                      <Badge className="mb-4 w-fit">Mais popular</Badge>
                    )}
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{plan.desc}</p>

                    <div className="mt-6 py-4 border-y border-border/40">
                      <p className="text-2xl font-extrabold text-primary">Sob consulta</p>
                      <p className="text-xs text-muted-foreground mt-1">Preço personalizado por unidade</p>
                    </div>

                    <ul className="mt-6 space-y-3 flex-1">
                      {plan.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2.5 text-sm">
                          <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>

                    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="block mt-8">
                      <Button
                        className="w-full gap-2 rounded-xl"
                        variant={plan.highlight ? "default" : "outline"}
                      >
                        <MessageCircle className="h-4 w-4" />
                        Entre em contato
                      </Button>
                    </a>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Depoimentos ─── */}
      <section id="depoimentos" className="py-24 md:py-32 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <AnimatedSection className="text-center mb-16">
            <Badge variant="outline" className="mb-4 text-xs px-3 py-1">Depoimentos</Badge>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Quem usa, recomenda</h2>
            <p className="mt-4 text-muted-foreground text-lg">Revendas de todo o Brasil já automatizaram com o Gás Fácil</p>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <AnimatedSection key={t.name} delay={i * 0.1}>
                <Card className="border-border/40 hover:shadow-lg transition-all duration-300 h-full">
                  <CardContent className="p-8">
                    <div className="flex gap-0.5 mb-5">
                      {Array.from({ length: t.stars }).map((_, j) => (
                        <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground mb-8">
                      "{t.text}"
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">{t.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="py-24 md:py-32">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <AnimatedSection className="text-center mb-16">
            <Badge variant="outline" className="mb-4 text-xs px-3 py-1">FAQ</Badge>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Perguntas frequentes</h2>
          </AnimatedSection>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <AnimatedSection key={i} delay={i * 0.04}>
                <div className="border border-border/50 rounded-xl overflow-hidden bg-card/50 hover:bg-card transition-colors">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-6 py-5 text-left font-semibold text-sm"
                  >
                    {faq.q}
                    <motion.div
                      animate={{ rotate: openFaq === i ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </motion.div>
                  </button>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Final ─── */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.15),transparent_70%)]" />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <AnimatedSection>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-6">
              Pronto para modernizar<br />sua revenda?
            </h2>
            <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
              Fale com nossa equipe e descubra como o Gás Fácil pode transformar a gestão da sua revenda.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="text-base px-10 h-13 gap-2.5 shadow-xl shadow-primary/25 rounded-xl">
                  <MessageCircle className="h-5 w-5" />
                  Falar pelo WhatsApp
                </Button>
              </a>
              <a href="mailto:contato@gasfacilpro.com.br">
                <Button variant="outline" size="lg" className="text-base px-10 h-13 gap-2 rounded-xl">
                  <Mail className="h-5 w-5" />
                  Enviar e-mail
                </Button>
              </a>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border/50 py-10 bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <img src={logoImg} alt="Gás Fácil" className="h-7 w-7 object-contain" />
              <span className="font-bold text-sm">Gás Fácil Pro</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-foreground transition-colors">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
              <a href="mailto:contato@gasfacilpro.com.br" className="flex items-center gap-2 hover:text-foreground transition-colors">
                <Mail className="h-4 w-4" /> contato@gasfacilpro.com.br
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Gás Fácil Pro. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
