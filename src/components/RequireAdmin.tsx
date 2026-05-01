import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useMockAuth } from '@/hooks/useMockAuth';

/** Gates a route to admin users only. Non-admins are sent to /. */
export function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user, loading } = useMockAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace state={{ from: location }} />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}
