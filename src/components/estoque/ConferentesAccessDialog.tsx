import { useMemo, useState } from 'react';
import { Loader2, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle } from '@/components/ui/responsive-dialog';
import { useUnidade } from '@/contexts/UnidadeContext';
import { conferenciaApi } from '@/lib/estoque/conferenciaPortal';

interface Access { user_id: string; full_name: string; email: string; ativo: boolean; unidade_ids: string[] }

export function ConferentesAccessDialog() {
  const { unidades } = useUnidade();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<Access[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lojas = useMemo(() => unidades.filter((u) => u.ativo), [unidades]);
  const load = async () => {
    setBusy(true); setError('');
    try { const result = await conferenciaApi({ action: 'list' }, true); setUsers(result.users); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar.'); }
    finally { setBusy(false); }
  };
  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await conferenciaApi({ action: 'create', full_name: name, email, password, unidade_ids: ids }, true);
      setName(''); setEmail(''); setPassword(''); setIds([]);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível cadastrar.'); }
    finally { setBusy(false); }
  };
  const toggle = async (access: Access) => {
    setBusy(true); setError('');
    try { await conferenciaApi({ action: 'update_access', user_id: access.user_id, ativo: !access.ativo }, true); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível alterar.'); }
    finally { setBusy(false); }
  };
  return <>
    <Button variant="outline" size="sm" className="h-10 gap-2" onClick={() => { setOpen(true); void load(); }}><Users className="h-4 w-4" />Conferentes</Button>
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogContent className="max-w-xl">
        <ResponsiveDialogHeader><ResponsiveDialogTitle>Acessos dos conferentes</ResponsiveDialogTitle></ResponsiveDialogHeader>
        <div className="space-y-5 pb-12 md:pb-0">
          <a href="https://app.gasfacilpro.com.br/estoque/conferencia" target="_blank" rel="noreferrer" className="block break-all text-sm text-primary underline">app.gasfacilpro.com.br/estoque/conferencia</a>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <form onSubmit={create} className="space-y-3">
            <div className="space-y-1"><Label htmlFor="conferente-name">Nome</Label><Input id="conferente-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} className="text-base" /></div>
            <div className="space-y-1"><Label htmlFor="conferente-email">E-mail de acesso</Label><Input id="conferente-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="text-base" /></div>
            <div className="space-y-1"><Label htmlFor="conferente-password">Senha inicial</Label><Input id="conferente-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required className="text-base" /></div>
            <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Lojas autorizadas</legend>
              {lojas.map((u) => <label key={u.id} className="flex items-center gap-3 text-sm"><Checkbox checked={ids.includes(u.id)} onCheckedChange={(checked) => setIds((prev) => checked ? [...prev, u.id] : prev.filter((id) => id !== u.id))} />{u.nome}</label>)}
            </fieldset>
            <Button type="submit" disabled={busy || ids.length === 0} className="w-full gap-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}Criar acesso</Button>
          </form>
          <div className="divide-y divide-border border-t border-border">
            {users.map((access) => <div key={access.user_id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0"><p className="break-words font-semibold">{access.full_name}</p><p className="break-all text-xs text-muted-foreground">{access.email}</p><p className="text-xs text-muted-foreground">{lojas.filter((u) => access.unidade_ids.includes(u.id)).map((u) => u.nome).join(' · ')}</p></div>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void toggle(access)}>{access.ativo ? 'Bloquear' : 'Liberar'}</Button>
            </div>)}
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  </>;
}