import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function Login() {
  const { login } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const success = await login(code.trim());
    if (!success) {
      setError('Invalid access code. Please try again.');
    }
    setLoading(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm animate-fade-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary">
            <span className="text-2xl" role="img" aria-label="Golf flag">⛳</span>
          </div>
          <CardTitle className="text-2xl">Fantasy Golf</CardTitle>
          <CardDescription>Enter your 6-digit access code</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Access Code</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="text-center text-xl tracking-[0.3em] font-mono"
                aria-describedby={error ? 'code-error' : undefined}
                autoFocus
              />
              {error && (
                <p id="code-error" className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={code.length !== 6 || loading}>
              {loading ? 'Verifying…' : 'Enter League'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
