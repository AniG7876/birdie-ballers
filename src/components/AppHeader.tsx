import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, Shield } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function AppHeader() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header className="border-b bg-primary text-primary-foreground" role="banner">
      <div className="container flex h-14 items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity"
          aria-label="Go to dashboard"
        >
          <span role="img" aria-hidden="true">⛳</span>
          Fantasy Golf
        </button>

        <nav className="flex items-center gap-2" aria-label="Main navigation">
          {isAdmin && (
            <Button
              variant={location.pathname === '/admin' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => navigate('/admin')}
              className={location.pathname !== '/admin' ? 'text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary/80' : ''}
            >
              <Shield className="h-4 w-4 mr-1" aria-hidden="true" />
              Admin
            </Button>
          )}
          <span className="text-sm text-primary-foreground/70 hidden sm:inline">
            {user?.name}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary/80"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </Button>
        </nav>
      </div>
    </header>
  );
}
