import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MANIFEST = '/conferencia.webmanifest';
const DISMISS_KEY = 'conferencia-install-dismissed';

/** Aponta o "Instalar app" para a Conferência enquanto esta tela estiver aberta. */
export function useConferenciaManifest() {
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) { link = document.createElement('link'); link.rel = 'manifest'; document.head.appendChild(link); }
    const prevHref = link.getAttribute('href');
    link.setAttribute('href', MANIFEST);
    let title = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    const created = !title;
    if (!title) { title = document.createElement('meta'); title.name = 'apple-mobile-web-app-title'; document.head.appendChild(title); }
    const prevTitle = title.getAttribute('content');
    title.setAttribute('content', 'Conferência');
    return () => {
      if (prevHref) link!.setAttribute('href', prevHref);
      if (created) title!.remove(); else if (prevTitle !== null) title!.setAttribute('content', prevTitle);
    };
  }, []);
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };

export function InstalarConferenciaBanner() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);
  const ios = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const mobile = typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  if (hidden || standalone || (!evt && !mobile)) return null;
  const fechar = () => { setHidden(true); try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ } };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground">
      <Download className="h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-bold">Instale o atalho da Conferência</p>
        <p className="text-xs text-muted-foreground">
          {evt ? 'O ícone abre direto nesta tela.' : ios ? 'Toque em Compartilhar → "Adicionar à Tela de Início".' : 'No menu do navegador (⋮), toque em "Instalar app" ou "Adicionar à tela inicial".'}
        </p>
      </div>
      {evt && <Button size="sm" onClick={async () => { await evt.prompt(); setEvt(null); }}>Instalar</Button>}
      <button type="button" aria-label="Fechar" onClick={fechar} className="p-1 text-muted-foreground"><X className="h-4 w-4" /></button>
    </div>
  );
}
