import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { ShieldCheck, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMockAuth } from '@/hooks/useMockAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HAS_API, api } from '@/lib/api';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().trim().email({ message: 'Ongeldig e-mailadres' }).max(255),
  password: z.string().min(1, { message: 'Wachtwoord is verplicht' }).max(100),
});

const bootstrapSchema = z.object({
  displayName: z.string().trim().min(2, 'Naam moet minstens 2 tekens zijn').max(50),
  email: z.string().trim().email({ message: 'Ongeldig e-mailadres' }).max(255),
  password: z
    .string()
    .min(12, 'Wachtwoord moet minimaal 12 tekens zijn')
    .regex(/[a-z]/, 'Minstens één kleine letter')
    .regex(/[A-Z]/, 'Minstens één hoofdletter')
    .regex(/[0-9]/, 'Minstens één cijfer')
    .regex(/[^A-Za-z0-9]/, 'Minstens één speciaal teken'),
});

const AdminLogin = () => {
  const { user, adminLogin, bootstrapAdmin, loading } = useMockAuth();
  const [submitting, setSubmitting] = useState(false);

  // Bootstrap availability (only shown when no admin exists yet).
  const [bootstrapAvailable, setBootstrapAvailable] = useState(false);
  const [showBootstrap, setShowBootstrap] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!HAS_API) {
        // Mock: check localStorage for any admin
        try {
          const raw = localStorage.getItem('mock_auth_users');
          const users = raw ? JSON.parse(raw) : [];
          if (!cancelled) setBootstrapAvailable(!users.some((u: { role: string }) => u.role === 'admin'));
        } catch { /* ignore */ }
        return;
      }
      try {
        const r = await api<{ available: boolean }>('/auth/bootstrap-admin/available', { auth: false });
        if (!cancelled) setBootstrapAvailable(r.available);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { if (i.path[0]) errs[i.path[0] as string] = i.message; });
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    const { error } = await adminLogin(parsed.data.email, parsed.data.password);
    setSubmitting(false);
    if (error) { toast.error(error); return; }
    toast.success('Welkom, beheerder.');
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = bootstrapSchema.safeParse({ displayName: name, email, password });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { if (i.path[0]) errs[i.path[0] as string] = i.message; });
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    const { error } = await bootstrapAdmin(parsed.data.email, parsed.data.password, parsed.data.displayName);
    setSubmitting(false);
    if (error) { toast.error(error); return; }
    toast.success('Beheerder aangemaakt.');
  };

  return (
    <div
      className="min-h-[100dvh] grid place-items-center px-4 py-10 relative overflow-hidden bg-slate-950"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 70% 40% at 50% 0%, hsl(280 80% 40% / 0.25), transparent 70%), radial-gradient(ellipse 60% 50% at 100% 100%, hsl(220 80% 40% / 0.18), transparent 70%)',
      }}
    >
      <Link
        to="/auth"
        className="absolute top-4 left-4 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Terug naar gebruikerslogin
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md relative"
      >
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 grid place-items-center shadow-[0_0_30px_hsl(280_80%_50%/0.5)]">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-display text-2xl tracking-wide text-slate-100">Beheerderspaneel</h1>
          <p className="text-sm text-center text-slate-400">
            Beveiligde toegang — alleen voor administrators.
          </p>
        </div>

        <Card className="shadow-2xl border-slate-800 bg-slate-900/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-normal text-slate-100">
              {showBootstrap ? 'Eerste beheerder aanmaken' : 'Beheerder inloggen'}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {showBootstrap
                ? 'Er is nog geen beheerder. Maak hier het eerste account aan.'
                : 'Gebruik je beheerdersaccount om verder te gaan.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showBootstrap ? (
              <form onSubmit={handleBootstrap} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bs-name" className="text-slate-300">Naam</Label>
                  <Input id="bs-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Beheerder" />
                  {errors.displayName && <p className="text-xs text-destructive">{errors.displayName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bs-email" className="text-slate-300">E-mailadres</Label>
                  <Input id="bs-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@voorbeeld.nl" />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bs-password" className="text-slate-300">Wachtwoord</Label>
                  <Input id="bs-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimaal 12 tekens, sterk" />
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Beheerder aanmaken'}
                </Button>
                <button type="button" onClick={() => setShowBootstrap(false)} className="w-full text-xs text-slate-400 hover:text-slate-200">
                  Toch inloggen met bestaand account
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-email" className="text-slate-300">E-mailadres</Label>
                  <Input id="admin-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@voorbeeld.nl" />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-password" className="text-slate-300">Wachtwoord</Label>
                  <Input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Inloggen als beheerder'}
                </Button>
                {bootstrapAvailable && (
                  <button type="button" onClick={() => setShowBootstrap(true)} className="w-full text-xs text-fuchsia-400 hover:text-fuchsia-300">
                    Nog geen beheerder — eerste account aanmaken
                  </button>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
