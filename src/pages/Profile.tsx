import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Shield, User as UserIcon } from 'lucide-react';
import { useMockAuth } from '@/hooks/useMockAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChangePasswordCard } from '@/components/ChangePasswordCard';
import { BackupCard } from '@/components/BackupCard';
import { getDiceBearAvatar } from '@/lib/avatar';
import { toast } from 'sonner';

const Profile = () => {
  const { user, updateProfile, logout } = useMockAuth();
  const [name, setName] = useState(user?.displayName ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');

  if (!user) return <Navigate to="/auth" replace />;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 50) {
      toast.error('Naam moet tussen 2 en 50 tekens zijn');
      return;
    }
    updateProfile({
      displayName: trimmed,
      avatarUrl: avatarUrl.trim() || null,
    });
    toast.success('Profiel bijgewerkt');
  };

  const avatarSrc = user.avatarUrl || getDiceBearAvatar(user.email || user.displayName);

  return (
    <div className="h-[100dvh] overflow-y-auto bg-background px-4 py-8">
      <div className="max-w-xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Terug naar notities
        </Link>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 overflow-hidden border border-border">
            <img src={avatarSrc} alt={user.displayName} className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl text-foreground truncate">{user.displayName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                  user.role === 'admin'
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'bg-muted text-muted-foreground border-border'
                }`}
              >
                {user.role === 'admin' ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                {user.role === 'admin' ? 'Admin' : 'Gebruiker'}
              </span>
              <span className="text-xs text-muted-foreground truncate">{user.email}</span>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-normal">Profielgegevens</CardTitle>
            <CardDescription>Pas je naam en avatar aan</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Naam</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="avatar">Avatar URL (optioneel)</Label>
                <Input
                  id="avatar"
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>E-mailadres</Label>
                <Input value={user.email} disabled />
              </div>
              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={logout}>
                  Uitloggen
                </Button>
                <Button type="submit">Opslaan</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6">
          <ChangePasswordCard />
        </div>

        <div className="mt-6">
          <BackupCard />
        </div>

      </div>
    </div>
  );
};

export default Profile;
