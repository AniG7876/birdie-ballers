import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type User = Tables<'users'>;

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  login: (code: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUserId = localStorage.getItem('fantasy_golf_user_id');
    if (savedUserId) {
      supabase
        .from('users')
        .select('*')
        .eq('id', savedUserId)
        .single()
        .then(({ data }) => {
          if (data) setUser(data);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (code: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('code', code)
      .single();

    if (error || !data) return false;

    setUser(data);
    localStorage.setItem('fantasy_golf_user_id', data.id);
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('fantasy_golf_user_id');
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin: user?.is_admin ?? false, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
