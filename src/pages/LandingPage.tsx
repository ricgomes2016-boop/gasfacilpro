import { useState } from "react";
import { Flame, ChevronDown, ChevronUp, Truck, ShoppingCart, BarChart3, Users, Wallet, Package, Star, MessageCircle, Phone, Mail, MapPin, Check, ArrowRight, Shield, Zap, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import logoImg from "@/assets/logo.png";

const APP_URL = "https://app.gasfacilpro.com.br";

const features = [
  { icon: ShoppingCart, title: "PDV & Vendas", desc: "Ponto de venda ágil, pedidos por WhatsApp, telefone e app do cliente. Controle total das suas vendas." },
  { icon: Truck, title: "Entregas & Logística", desc: "App exclusivo para entregadores com GPS, rotas otimizadas e rastreamento em tempo real." },
  { icon: Package, title: "Estoque Inteligente", desc: "Controle de cilindros, comodatos, transferências entre unidades e alertas automáticos." },
  { icon: Wallet, title: "Financeiro Completo", desc: "Contas a pagar/receber, fluxo de caixa, conciliação bancária e emissão de boletos." },
  { icon: Users, title: "RH & Comissões", desc: "Folha de pagamento, ponto eletrônico, comissões automáticas e banco de horas." },
  { icon: BarChart3, title: "Dashboards & IA", desc: "Insights com inteligência artificial, relatórios gerenciais e indicadores em tempo real." },
  { icon: Shield, title: "Fiscal & Compliance", desc: "Emissão de NF-e, NFC-e, CT-e e MDF-e integrada diretamente ao sistema." },
  { icon: Globe, title: "Multi-unidades", desc: "Gerencie várias filiais com dados consolidados, permissões por unidade e visão centralizada." },
];

const plans = [
  {
    name: "Básico",
    price: "99",
    period: "/mês por unidade",
    highlight: false,
    features: ["5 usuários por unidade", "Vendas e Estoque", "Entregas e Caixa", "Relatórios essenciais", "App do Entregador", "App do Cliente"],
  },
  {
    name: "Standard",
    price: "249",
    period: "/mês por unidade",
    highlight: true,
    features: ["10 usuários por unidade", "Tudo do Básico", "Financeiro completo", "RH e Comissões", "Assistente IA", "Dashboards avançados", "Usuário extra: R$29,90"],
  },
  {
    name: "Enterprise",
    price: "499",
    period: "/mês por unidade",
    highlight: false,
    features: ["20 usuários por unidade", "Tudo do Standard", "Fiscal (NF-e, CT-e)", "Frota completa", "API e Integrações", "Suporte prioritário", "Usuário extra: R$49,90"],
  },
];

const testimonials = [
  { name: "Carlos Mendes", role: "Proprietário — Central Gás", text: "Depois do Gás Fácil, reduzi em 40% o tempo de acerto com entregadores. O controle financeiro ficou impecável.", stars: 5 },
  { name: "Ana Souza", role: "Gestora — Forte Gás", text: "O app do entregador mudou nosso jogo. Rastreamento em tempo real e os clientes adoram acompanhar a entrega.", stars: 5 },
  { name: "Roberto Lima", role: "Diretor — Morumbi Gás", text: "Gerenciar 3 unidades era um caos. Com o painel multi-unidades, tenho tudo consolidado em um só lugar.", stars: 5 },
];

const faqs = [
  { q: "Preciso instalar algum aplicativo?", a: "Não! O Gás Fácil é um sistema 100% web (PWA). Funciona direto no navegador do celular ou computador, sem precisar baixar nada na loja de apps." },
  { q: "Posso testar antes de assinar?", a: "Sim! Entre em contato conosco para conhecer nossos planos e condições especiais." },
  { q: "Funciona para múltiplas filiais?", a: "Sim! O sistema suporta múltiplas unidades com dados consolidados, permissões individuais e transferência de estoque entre filiais." },
  { q: "Como funciona o app do entregador?", a: "O entregador acessa pelo celular, recebe os pedidos em tempo real, tem rota otimizada por GPS e faz o acerto financeiro direto no app." },
  { q: "Vocês emitem nota fiscal?", a: "Sim! No plano Enterprise, você emite NF-e, NFC-e, CT-e e MDF-e diretamente pelo sistema, com integração automática." },
  { q: "Qual o suporte oferecido?", a: "Todos os planos incluem suporte por chat e e-mail. O plano Enterprise tem suporte prioritário com atendimento dedicado." },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <div className="flex items-center gap-2.5">
            <img src={logoImg} alt="Gás Fácil" className="h-8 w-8 object-contain" />
            <span className="font-bold text-xl text-foreground">Gás Fácil</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#funcionalidades" className="hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#precos" className="hover:text-foreground transition-colors">Preços</a>
            <a href="#depoimentos" className="hover:text-foreground transition-colors">Depoimentos</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <a href={`${APP_URL}/auth`}>
              <Button variant="outline" size="sm">Entrar</Button>
            </a>
            <a href={`${APP_URL}/auth`} className="hidden sm:block">
              <Button size="sm" className="gap-1.5">
                Começar agora <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[var(--gradient-primary)] opacity-[0.04]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-32 text-center relative">
          <Badge variant="secondary" className="mb-6 text-sm px-4 py-1.5">
            <Zap className="h-3.5 w-3.5 mr-1.5" /> Sistema completo para revendas de gás
          </Badge>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight max-w-4xl mx-auto">
            O ERP completo para sua{" "}
            <span className="text-primary">revenda de gás</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Vendas, entregas, estoque, financeiro e muito mais — tudo em um só sistema. 
            Do pedido à entrega, automatize sua operação e venda mais.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={`${APP_URL}/auth`}>
              <Button size="lg" className="text-base px-8 h-12 gap-2 shadow-lg">
                <Flame className="h-5 w-5" />
                Começar agora
              </Button>
            </a>
            <a href="#funcionalidades">
              <Button variant="outline" size="lg" className="text-base px-8 h-12">
                Ver funcionalidades
              </Button>
            </a>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Sem instalação • Funciona no celular e computador</p>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="py-20 md:py-28 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">Tudo que sua revenda precisa</h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
              Módulos integrados que cobrem cada área do seu negócio
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <Card key={f.title} className="group hover:shadow-lg transition-all duration-300 border-border/60 hover:border-primary/30">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <f.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Preços */}
      <section id="precos" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">Planos para cada tamanho</h2>
            <p className="mt-4 text-muted-foreground text-lg">Escolha o plano ideal para o seu negócio</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative overflow-hidden transition-all duration-300 ${
                  plan.highlight
                    ? "border-primary shadow-lg scale-[1.02] ring-1 ring-primary/20"
                    : "border-border/60 hover:shadow-md"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
                )}
                <CardContent className="p-8">
                  {plan.highlight && (
                    <Badge className="mb-4">Mais popular</Badge>
                  )}
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-sm text-muted-foreground">R$</span>
                    <span className="text-4xl font-extrabold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  <ul className="mt-8 space-y-3">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <a href={`${APP_URL}/auth`} className="block mt-8">
                    <Button
                      className="w-full"
                      variant={plan.highlight ? "default" : "outline"}
                    >
                      Assinar agora
                    </Button>
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section id="depoimentos" className="py-20 md:py-28 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">Quem usa, recomenda</h2>
            <p className="mt-4 text-muted-foreground text-lg">Revendas de todo o Brasil já automatizaram com o Gás Fácil</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t) => (
              <Card key={t.name} className="border-border/60">
                <CardContent className="p-8">
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: t.stars }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-warning text-warning" />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground italic mb-6">
                    "{t.text}"
                  </p>
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">Perguntas frequentes</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="border border-border/60 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left font-medium text-sm hover:bg-muted/50 transition-colors"
                >
                  {faq.q}
                  {openFaq === i ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-sm text-muted-foreground leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contato / CTA final */}
      <section id="contato" className="py-20 md:py-28 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Pronto para modernizar sua revenda?</h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-2xl mx-auto">
            Comece gratuitamente em menos de 2 minutos. Sem cartão, sem instalação.
          </p>
          <a href={`${APP_URL}/auth`}>
            <Button size="lg" className="text-base px-10 h-12 gap-2 shadow-lg">
              <Flame className="h-5 w-5" />
              Criar conta
            </Button>
          </a>
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-muted-foreground">
            <a href="https://wa.me/5511999999999" className="flex items-center gap-2 hover:text-foreground transition-colors">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            <a href="mailto:contato@gasfacilpro.com.br" className="flex items-center gap-2 hover:text-foreground transition-colors">
              <Mail className="h-4 w-4" /> contato@gasfacilpro.com.br
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="Gás Fácil" className="h-6 w-6 object-contain" />
            <span className="font-semibold text-sm">Gás Fácil</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Gás Fácil Pro. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
