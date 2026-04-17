import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { BookOpen, Loader2 } from 'lucide-react';
import { useMockAuth } from '@/hooks/useMockAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().trim().email({ message: 'Ongeldig e-mailadres' }).max(255),
  password: z.string().min(1, { message: 'Wachtwoord is verplicht' }).max(100),
});

const signupSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, { message: 'Naam moet minstens 2 tekens zijn' })
    .max(50, { message: 'Naam mag maximaal 50 tekens zijn' }),
  email: z.string().trim().email({ message: 'Ongeldig e-mailadres' }).max(255),
  password: z
    .string()
    .min(6, { message: 'Wachtwoord moet minstens 6 tekens zijn' })
    .max(100, { message: 'Wachtwoord mag maximaal 100 tekens zijn' }),
});

const Auth = () => {
  const navigate = useNavigate();
  const { user, login, signup, loading } = useMockAuth();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [submitting, setSubmitting] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});

  // Signup form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupErrors, setSignupErrors] = useState<Record<string, string>>({});

  if (loading) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErrors({});
    const parsed = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        if (i.path[0]) errs[i.path[0] as string] = i.message;
      });
      setLoginErrors(errs);
      return;
    }
    setSubmitting(true);
    const { error } = await login(parsed.data.email, parsed.data.password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Welkom terug!');
    navigate('/');
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupErrors({});
    const parsed = signupSchema.safeParse({ displayName: name, email, password });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        if (i.path[0]) errs[i.path[0] as string] = i.message;
      });
      setSignupErrors(errs);
      return;
    }
    setSubmitting(true);
    const { error } = await signup(parsed.data.email, parsed.data.password, parsed.data.displayName);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Account aangemaakt!');
    navigate('/');
  };

  return (
    <div className="min-h-[100dvh] grid place-items-center bg-background px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <h1 className="font-display text-2xl text-foreground tracking-wide">Notities</h1>
          <p className="text-sm text-muted-foreground text-center">
            Meld je aan om je persoonlijke notities te beheren
          </p>
        </div>

        <Card className="shadow-sm border-border">
          <CardHeader className="pb-3">
            <Tabs value={tab} onValueChange={(v) => setTab(v as 'login' | 'signup')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Inloggen</TabsTrigger>
                <TabsTrigger value="signup">Registreren</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-4">
                <CardTitle className="text-lg font-normal mb-1">Welkom terug</CardTitle>
                <CardDescription className="mb-4">Log in met je e-mailadres en wachtwoord</CardDescription>
                <form onSubmit={handleLogin} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email">E-mailadres</Label>
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="jij@voorbeeld.nl"
                    />
                    {loginErrors.email && (
                      <p className="text-xs text-destructive">{loginErrors.email}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password">Wachtwoord</Label>
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                    {loginErrors.password && (
                      <p className="text-xs text-destructive">{loginErrors.password}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Inloggen'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-4">
                <CardTitle className="text-lg font-normal mb-1">Maak een account</CardTitle>
                <CardDescription className="mb-4">
                  De eerste gebruiker wordt automatisch admin
                </CardDescription>
                <form onSubmit={handleSignup} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-name">Naam</Label>
                    <Input
                      id="signup-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jouw naam"
                    />
                    {signupErrors.displayName && (
                      <p className="text-xs text-destructive">{signupErrors.displayName}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-email">E-mailadres</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jij@voorbeeld.nl"
                    />
                    {signupErrors.email && (
                      <p className="text-xs text-destructive">{signupErrors.email}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-password">Wachtwoord</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minstens 6 tekens"
                    />
                    {signupErrors.password && (
                      <p className="text-xs text-destructive">{signupErrors.password}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Account aanmaken'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              Demo-modus: gegevens worden lokaal in je browser bewaard.
              <br />
              Geen echte beveiliging — niet gebruiken voor gevoelige data.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Auth;
