import { useState } from 'react';
import { Eye, EyeOff, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useMockAuth } from '@/hooks/useMockAuth';
import { PASSWORD_REQUIREMENTS, validatePassword } from '@/lib/passwordPolicy';
import { toast } from 'sonner';

export function ChangePasswordCard() {
  const { changePassword } = useMockAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const passedCount = PASSWORD_REQUIREMENTS.filter((r) => r.test(newPassword)).length;
  const strengthPct = (passedCount / PASSWORD_REQUIREMENTS.length) * 100;
  const strengthColor =
    passedCount <= 2 ? 'bg-destructive' : passedCount <= 4 ? 'bg-yellow-500' : 'bg-green-500';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Vul je huidige wachtwoord in');
      return;
    }
    const check = validatePassword(newPassword);
    if (!check.ok) {
      toast.error(check.errors[0]);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('De nieuwe wachtwoorden komen niet overeen');
      return;
    }
    if (newPassword === currentPassword) {
      toast.error('Nieuw wachtwoord moet verschillen van het huidige wachtwoord');
      return;
    }

    setSubmitting(true);
    const { error } = await changePassword(currentPassword, newPassword);
    setSubmitting(false);

    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Wachtwoord bijgewerkt');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-normal">Wachtwoord wijzigen</CardTitle>
        <CardDescription>Kies een sterk, uniek wachtwoord dat je nergens anders gebruikt.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Huidig wachtwoord</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                aria-label={showCurrent ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="newPassword">Nieuw wachtwoord</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                aria-label={showNew ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {newPassword.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${strengthColor}`}
                    style={{ width: `${strengthPct}%` }}
                  />
                </div>
                <ul className="space-y-1">
                  {PASSWORD_REQUIREMENTS.map((req) => {
                    const ok = req.test(newPassword);
                    return (
                      <li
                        key={req.label}
                        className={`flex items-center gap-1.5 text-xs ${
                          ok ? 'text-green-600 dark:text-green-500' : 'text-muted-foreground'
                        }`}
                      >
                        {ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {req.label}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Bevestig nieuw wachtwoord</Label>
            <Input
              id="confirmPassword"
              type={showNew ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            {confirmPassword.length > 0 && confirmPassword !== newPassword && (
              <p className="text-xs text-destructive">Wachtwoorden komen niet overeen</p>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Bezig...' : 'Wachtwoord wijzigen'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
