import { RefreshCw, Trash2, Download, Smartphone, Apple, Chrome } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function Suporte() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <RefreshCw className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Atualizar o App</h1>
          <p className="text-muted-foreground text-sm">
            Se o app não atualizou automaticamente, siga as instruções abaixo para o seu dispositivo.
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {/* Android / Chrome */}
          <AccordionItem value="android" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Chrome className="h-5 w-5 text-primary" />
                <span className="font-semibold">Android / Chrome</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pb-2">
                <Card className="border-muted">
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-medium flex items-center gap-2">
                      <Trash2 className="h-4 w-4 text-destructive" />
                      Opção 1: Limpar cache
                    </h3>
                    <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
                      <li>Abra o <strong>Chrome</strong></li>
                      <li>Toque nos <strong>três pontinhos</strong> (⋮) no canto superior</li>
                      <li>Vá em <strong>Configurações → Privacidade → Limpar dados de navegação</strong></li>
                      <li>Marque <strong>"Imagens e arquivos armazenados em cache"</strong></li>
                      <li>Toque em <strong>"Limpar dados"</strong></li>
                      <li>Abra o app novamente</li>
                    </ol>
                  </CardContent>
                </Card>
                <Card className="border-muted">
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-medium flex items-center gap-2">
                      <Download className="h-4 w-4 text-primary" />
                      Opção 2: Reinstalar o app
                    </h3>
                    <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
                      <li>Na tela inicial, <strong>segure o ícone</strong> do Gás Fácil</li>
                      <li>Toque em <strong>"Desinstalar"</strong></li>
                      <li>Acesse <strong>gasfacilpro.lovable.app/instalar</strong> pelo Chrome</li>
                      <li>Instale novamente</li>
                    </ol>
                  </CardContent>
                </Card>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* iPhone / Safari */}
          <AccordionItem value="ios" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Apple className="h-5 w-5 text-primary" />
                <span className="font-semibold">iPhone / Safari</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pb-2">
                <Card className="border-muted">
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-medium flex items-center gap-2">
                      <Trash2 className="h-4 w-4 text-destructive" />
                      Opção 1: Limpar cache do Safari
                    </h3>
                    <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
                      <li>Abra <strong>Ajustes</strong> do iPhone</li>
                      <li>Vá em <strong>Safari → Limpar Histórico e Dados</strong></li>
                      <li>Confirme a limpeza</li>
                      <li>Abra o app novamente</li>
                    </ol>
                  </CardContent>
                </Card>
                <Card className="border-muted">
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-medium flex items-center gap-2">
                      <Download className="h-4 w-4 text-primary" />
                      Opção 2: Reinstalar o app
                    </h3>
                    <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
                      <li>Na tela inicial, <strong>segure o ícone</strong> do Gás Fácil</li>
                      <li>Toque em <strong>"Remover App" → "Apagar da Tela de Início"</strong></li>
                      <li>Acesse <strong>gasfacilpro.lovable.app/instalar</strong> pelo Safari</li>
                      <li>Toque em <strong>Compartilhar → Adicionar à Tela de Início</strong></li>
                    </ol>
                  </CardContent>
                </Card>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Desktop */}
          <AccordionItem value="desktop" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-primary" />
                <span className="font-semibold">Computador (Chrome)</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <Card className="border-muted">
                <CardContent className="p-4 space-y-3">
                  <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
                    <li>Pressione <strong>Ctrl + Shift + Delete</strong> (ou ⌘ + Shift + Delete no Mac)</li>
                    <li>Marque <strong>"Imagens e arquivos em cache"</strong></li>
                    <li>Clique em <strong>"Limpar dados"</strong></li>
                    <li>Recarregue a página com <strong>Ctrl + F5</strong></li>
                  </ol>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <p className="text-center text-xs text-muted-foreground">
          <a href="/instalar" className="text-primary hover:underline">Instalar o app</a>
          {" · "}
          <a href="/auth" className="text-primary hover:underline">Voltar ao login</a>
        </p>
      </div>
    </div>
  );
}
