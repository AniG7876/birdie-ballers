import { useState } from 'react';
import { useUsers } from '@/hooks/useFantasyData';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Copy, UserPlus, Trash2, Pencil, RefreshCw, Check, X } from 'lucide-react';

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function AdminUsers() {
  const { data: users, isLoading } = useUsers();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);

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

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    setLoadingId(id);
    const { error } = await supabase.from('users').update({ name: editName.trim() }).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Name updated' });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      cancelEdit();
    }
    setLoadingId(null);
  };

  const regenCode = async (id: string) => {
    setLoadingId(id);
    const code = generateCode();
    const { error } = await supabase.from('users').update({ code }).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Code regenerated', description: `New code: ${code}` });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
    setLoadingId(null);
  };

  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`Delete player "${name}"? This cannot be undone.`)) return;
    setLoadingId(id);
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'User deleted' });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
    setLoadingId(null);
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
                    <td className="py-2 pr-4">
                      {editingId === u.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(u.id); if (e.key === 'Escape') cancelEdit(); }}
                            className="h-7 w-36 text-sm"
                            maxLength={50}
                            autoFocus
                          />
                          <Button variant="ghost" size="sm" onClick={() => saveEdit(u.id)} disabled={loadingId === u.id} aria-label="Save name">
                            <Check className="h-3.5 w-3.5 text-primary" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={cancelEdit} aria-label="Cancel edit">
                            <X className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        u.name
                      )}
                    </td>
                    <td className="py-2 pr-4 font-mono tracking-wider">{u.code}</td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => copyCode(u.code)} aria-label={`Copy code for ${u.name}`}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => startEdit(u.id, u.name)} disabled={loadingId === u.id || editingId === u.id} aria-label={`Rename ${u.name}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => regenCode(u.id)} disabled={loadingId === u.id} aria-label={`Regenerate code for ${u.name}`}>
                          <RefreshCw className={`h-4 w-4 ${loadingId === u.id ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteUser(u.id, u.name)} disabled={loadingId === u.id} aria-label={`Delete ${u.name}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
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
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
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
