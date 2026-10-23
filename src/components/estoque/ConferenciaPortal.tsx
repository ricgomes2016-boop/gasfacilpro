import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { ClipboardCheck, Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { conferenciaApi, conferenciaAuth } from '@/lib/estoque/conferenciaPortal';
import { Unidade } from '@/contexts/UnidadeContext';
import ConferenciaEstoque from '@/pages/estoque/ConferenciaEstoque';

export function ConferenciaPortal() {
  const [user, setUser] = useState<User | null>(null);
  const [units, setUnits] = useState<Unidade[]>([]);
  const [destinations, setDestinations] = useState<Unidade[]>([]);
  const [name, setName] = useState('');
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'Conferência de Estoque | Gás Fácil Pro';
    let active = true;
    const refresh = async () => {
      setReady(false);
      try {
        const { data: { user: validUser } } = await conferenciaAuth.auth.getUser();
        if (!active) return;
        setUser(validUser);
        if (validUser) {
          const result = await conferenciaApi({ action: 'session' });
          if (active) { setUnits(result.unidades); setDestinations(result.destinos || result.unidades); setName(result.name); setError(''); }
        } else { setUnits([]); }
      } catch (e) { if (active) { setUnits([]); setError(e instanceof Error ? e.message : 'Acesso indisponível.'); } }
      finally { if (active) setReady(true); }
    };
    const { data: { subscription } } = conferenciaAuth.auth.onAuthStateChange(() => { setTimeout(() => { if (active) void refresh(); }, 0); });
    void refresh();
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const login = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await conferenciaAuth.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) setError('E-mail ou senha inválidos, ou acesso não confirmado.');
      else setPassword('');
    } catch { setError('Não foi possível entrar. Tente novamente.'); }
    finally { setBusy(false); }
  };
  const logout = async () => { await conferenciaAuth.auth.signOut(); setUnits([]); setUser(null); setError(''); };
  if (!ready) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 aria-label="Carregando acesso" className="h-8 w-8 animate-spin text-primary" /></div>;
  if (user && units.length) return <ConferenciaEstoque portal={{ unidades: units, destinos: destinations, userId: user.id, name, onSignOut: logout }} />;
  return <main className="flex min-h-screen flex-col justify-center bg-background px-5 py-8 text-foreground">
    <div className="mx-auto w-full max-w-sm space-y-6">
      <div className="space-y-3"><ClipboardCheck className="h-12 w-12 text-primary" /><p className="text-sm font-semibold text-muted-foreground">Gás Fácil Pro · Pátio</p><h1 className="text-3xl font-bold">Conferência de estoque</h1></div>
      {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {user ? <Button variant="outline" onClick={() => void logout()} className="w-full gap-2"><LogOut className="h-4 w-4" />Sair</Button> : <form onSubmit={login} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="yard-email">E-mail</Label><Input id="yard-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Digite seu email" className="h-12 text-base" /></div>
        <div className="space-y-2"><Label htmlFor="yard-password">Senha</Label><Input id="yard-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Digite sua senha" className="h-12 text-base" /></div>
        <Button type="submit" disabled={busy} className="h-12 w-full gap-2 !text-primary-foreground">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Entrar</Button>
      </form>}
    </div>
  </main>;
}