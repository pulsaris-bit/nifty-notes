import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield, Users, Database, LogOut, RefreshCw, Trash2, KeyRound, Pencil,
  HardDrive, Activity, Loader2, AlertTriangle,
} from 'lucide-react';
import { useMockAuth } from '@/hooks/useMockAuth';
import { api, HAS_API, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'admin' | 'user';
  createdAt: string;
  updatedAt: string;
  noteCount: number;
  trashedCount: number;
  notebookCount: number;
  labelCount: number;
}

interface Stats {
  users: number;
  newUsers7d: number;
  notes: number;
  trashedNotes: number;
  notebooks: number;
  labels: number;
  shares: number;
  versions: number;
  databaseBytes: number;
  serverTime: string;
}

interface Health {
  ok: boolean;
  dbLatencyMs?: number;
  uptimeSec?: number;
  error?: string;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function formatDuration(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}u`;
  if (h > 0) return `${h}u ${m}m`;
  return `${m}m`;
}

const Admin = () => {
  const { user, logout } = useMockAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);

  const loadAll = async () => {
    if (!HAS_API) {
      toast.error('Beheerderspaneel vereist de zelf-gehoste backend.');
      setLoading(false);
      return;
    }
    setRefreshing(true);
    try {
      const [u, s, h] = await Promise.all([
        api<{ users: AdminUser[] }>('/admin/users'),
        api<Stats>('/admin/stats'),
        api<Health>('/admin/health'),
      ]);
      setUsers(u.users);
      setStats(s);
      setHealth(h);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Laden mislukt');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary grid place-items-center">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-lg leading-tight">Beheerderspaneel</h1>
            <p className="text-xs text-muted-foreground truncate">
              Ingelogd als {user?.displayName} ({user?.email})
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={loadAll} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Vernieuwen
          </Button>
          <Link to="/profile">
            <Button variant="ghost" size="sm">Profiel</Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" /> Uitloggen
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {!HAS_API && (
          <Card className="mb-6 border-destructive/40 bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm">
                Het beheerderspaneel werkt alleen in de zelf-gehoste versie (backend niet bereikbaar in deze preview).
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 py-4">
            <Shield className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Privacy: notities zijn niet zichtbaar</p>
              <p className="text-muted-foreground mt-1">
                Beheerders zien alleen aantallen per gebruiker — geen titels, inhoud of bijlagen.
              </p>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="grid place-items-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="status">
            <TabsList className="mb-4">
              <TabsTrigger value="status"><Database className="w-4 h-4 mr-2" />Database status</TabsTrigger>
              <TabsTrigger value="users"><Users className="w-4 h-4 mr-2" />Gebruikers</TabsTrigger>
            </TabsList>

            {/* ---------- Database status ---------- */}
            <TabsContent value="status" className="space-y-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <StatTile icon={<Activity className="w-4 h-4" />} label="API status">
                  {health?.ok ? (
                    <span className="text-emerald-500 font-medium">Online</span>
                  ) : (
                    <span className="text-destructive font-medium">Offline</span>
                  )}
                  {health?.ok && (
                    <div className="text-xs text-muted-foreground mt-1">
                      DB latency: {health.dbLatencyMs} ms · uptime {formatDuration(health.uptimeSec ?? 0)}
                    </div>
                  )}
                </StatTile>
                <StatTile icon={<HardDrive className="w-4 h-4" />} label="Database grootte">
                  {stats ? formatBytes(stats.databaseBytes) : '—'}
                </StatTile>
                <StatTile icon={<Users className="w-4 h-4" />} label="Gebruikers">
                  {stats?.users ?? 0}
                  {stats && stats.newUsers7d > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">+{stats.newUsers7d} (7d)</span>
                  )}
                </StatTile>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Aantallen</CardTitle>
                  <CardDescription>Totalen per tabel — geen inhoud zichtbaar.</CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                    <Row label="Notities (actief)" value={stats?.notes ?? 0} />
                    <Row label="In prullenbak" value={stats?.trashedNotes ?? 0} />
                    <Row label="Notitieboeken" value={stats?.notebooks ?? 0} />
                    <Row label="Labels" value={stats?.labels ?? 0} />
                    
                    <Row label="Versies (historie)" value={stats?.versions ?? 0} />
                    <Row label="Gedeelde notities" value={stats?.shares ?? 0} />
                    <Row label="Server tijd" value={stats ? new Date(stats.serverTime).toLocaleString('nl-NL') : '—'} />
                  </dl>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---------- Users ---------- */}
            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Gebruikers ({users.length})</CardTitle>
                  <CardDescription>
                    Aantallen per gebruiker. Klik op het potlood om gegevens aan te passen.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                        <tr>
                          <th className="text-left font-medium px-4 py-2">Gebruiker</th>
                          <th className="text-left font-medium px-2 py-2">Rol</th>
                          <th className="text-right font-medium px-2 py-2">Notities</th>
                          <th className="text-right font-medium px-2 py-2">Boeken</th>
                          <th className="text-right font-medium px-4 py-2">Acties</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <div className="font-medium">{u.displayName || '—'}</div>
                              <div className="text-xs text-muted-foreground">{u.email}</div>
                            </td>
                            <td className="px-2 py-3">
                              <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                                {u.role}
                              </Badge>
                            </td>
                            <td className="px-2 py-3 text-right tabular-nums">
                              {u.noteCount}
                              {u.trashedCount > 0 && (
                                <span className="text-xs text-muted-foreground"> (+{u.trashedCount})</span>
                              )}
                            </td>
                            <td className="px-2 py-3 text-right tabular-nums">{u.notebookCount}</td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <Button size="icon" variant="ghost" onClick={() => setEditing(u)} title="Bewerken">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => setResetting(u)} title="Wachtwoord resetten">
                                <KeyRound className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setDeleting(u)}
                                disabled={u.id === user?.id}
                                title={u.id === user?.id ? 'Eigen account kan niet verwijderd worden' : 'Verwijderen'}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Edit user */}
      <EditUserDialog
        open={!!editing}
        user={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); loadAll(); }}
        currentUserId={user?.id}
      />

      {/* Reset password */}
      <ResetPasswordDialog
        open={!!resetting}
        user={resetting}
        onClose={() => setResetting(null)}
        onDone={() => setResetting(null)}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gebruiker verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit verwijdert <strong>{deleting?.displayName || deleting?.email}</strong> en alle bijbehorende
              notities, notitieboeken en bijlagen. Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleting) return;
                try {
                  await api(`/admin/users/${deleting.id}`, { method: 'DELETE' });
                  toast.success('Gebruiker verwijderd');
                  setDeleting(null);
                  loadAll();
                } catch (e) {
                  toast.error(e instanceof ApiError ? e.message : 'Verwijderen mislukt');
                }
              }}
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ---------- Helpers ----------

function StatTile({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          {icon}<span>{label}</span>
        </div>
        <div className="text-xl font-display">{children}</div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function EditUserDialog({
  open, user, onClose, onSaved, currentUserId,
}: {
  open: boolean;
  user: AdminUser | null;
  onClose: () => void;
  onSaved: () => void;
  currentUserId?: string;
}) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setEmail(user.email);
      setDisplayName(user.displayName || '');
      setRole(user.role);
    }
  }, [user]);

  if (!user) return null;
  const isSelf = user.id === currentUserId;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gebruiker bewerken</DialogTitle>
          <DialogDescription>E-mail, naam en rol aanpassen.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-email">E-mailadres</Label>
            <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Naam</Label>
            <Input id="edit-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-role">Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'user')}>
              <SelectTrigger id="edit-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Gebruiker</SelectItem>
                <SelectItem value="admin">Beheerder</SelectItem>
              </SelectContent>
            </Select>
            {isSelf && (
              <p className="text-xs text-muted-foreground">
                Let op: je kunt jezelf alleen degraderen als er nog een andere admin is.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuleren</Button>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                const body: Record<string, unknown> = {};
                if (email !== user.email) body.email = email.trim();
                if (displayName !== (user.displayName || '')) body.displayName = displayName.trim();
                if (role !== user.role) body.role = role;
                if (Object.keys(body).length === 0) { onClose(); return; }
                await api(`/admin/users/${user.id}`, { method: 'PATCH', body });
                toast.success('Bijgewerkt');
                onSaved();
              } catch (e) {
                toast.error(e instanceof ApiError ? e.message : 'Opslaan mislukt');
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Opslaan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  open, user, onClose, onDone,
}: {
  open: boolean;
  user: AdminUser | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pw, setPw] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setPw(''); }, [open]);
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Wachtwoord resetten</DialogTitle>
          <DialogDescription>
            Stel een nieuw wachtwoord in voor <strong>{user.displayName || user.email}</strong>.
            Minimaal 12 tekens, met hoofdletter, kleine letter, cijfer en speciaal teken.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reset-pw">Nieuw wachtwoord</Label>
          <Input
            id="reset-pw"
            type="text"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Bijv. Welkom2026!Extra"
            autoComplete="new-password"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuleren</Button>
          <Button
            disabled={saving || pw.length < 12}
            onClick={async () => {
              setSaving(true);
              try {
                await api(`/admin/users/${user.id}/reset-password`, {
                  method: 'POST',
                  body: { newPassword: pw },
                });
                toast.success('Wachtwoord gereset');
                onDone();
              } catch (e) {
                toast.error(e instanceof ApiError ? e.message : 'Reset mislukt');
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Resetten'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default Admin;
