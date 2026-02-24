import { useState } from 'react';
import { useUsers } from '@/hooks/useFantasyData';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Copy, UserPlus } from 'lucide-react';

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function AdminUsers() {
  const { data: users, isLoading } = useUsers();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const nonAdminUsers = users?.filter((u) => !u.is_admin) ?? [];

  const handleAdd = async () => {
    if (!newName.trim()) return;
    if (nonAdminUsers.length >= 10) {
      toast({ title: 'Limit reached', description: 'Maximum 10 players allowed.', variant: 'destructive' });
      return;
    }

    setAdding(true);
    const code = generateCode();
    const { error } = await supabase.from('users').insert({ name: newName.trim(), code, is_admin: false });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'User added', description: `Code: ${code}` });
      setNewName('');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
    setAdding(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: 'Copied!', description: 'Access code copied to clipboard.' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Manage Players ({nonAdminUsers.length}/10)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <caption className="sr-only">Players list</caption>
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-semibold text-muted-foreground" scope="col">Name</th>
                  <th className="text-left py-2 pr-4 font-semibold text-muted-foreground" scope="col">Code</th>
                  <th className="text-right py-2 font-semibold text-muted-foreground" scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {nonAdminUsers.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{u.name}</td>
                    <td className="py-2 pr-4 font-mono tracking-wider">{u.code}</td>
                    <td className="py-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => copyCode(u.code)} aria-label={`Copy code for ${u.name}`}>
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <div className="flex-1">
            <Label htmlFor="new-player-name" className="sr-only">New player name</Label>
            <Input
              id="new-player-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Player name"
              maxLength={50}
            />
          </div>
          <Button onClick={handleAdd} disabled={adding || !newName.trim()}>
            <UserPlus className="h-4 w-4 mr-1" aria-hidden="true" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
