import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Settings } from 'lucide-react';

function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('settings').select('*').order('key');
      if (error) throw error;
      return data;
    },
  });
}

export default function AdminSettings() {
  const { data: settings, isLoading } = useSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const handleChange = (key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async (key: string) => {
    const raw = values[key];
    if (raw === undefined || raw === '') return;
    const num = parseFloat(raw);
    if (isNaN(num) || num < 1) {
      toast({ title: 'Invalid value', description: 'Value must be a number ≥ 1.', variant: 'destructive' });
      return;
    }
    setSaving((prev) => ({ ...prev, [key]: true }));
    const { error } = await supabase.from('settings').update({ value: num, updated_at: new Date().toISOString() }).eq('key', key);
    setSaving((prev) => ({ ...prev, [key]: false }));
    if (error) {
      toast({ title: 'Error', description: 'Failed to save setting.', variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setValues((prev) => { const next = { ...prev }; delete next[key]; return next; });
      toast({ title: 'Saved!', description: 'Setting updated successfully.' });
    }
  };

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading settings…</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="h-5 w-5" aria-hidden="true" />
          Game Settings
        </CardTitle>
        <CardDescription>
          Configure the bidding rules for all tournaments. Changes take effect immediately for any open bidding windows.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {settings?.map((s) => {
            const currentVal = values[s.key] ?? String(s.value);
            return (
              <div key={s.key} className="space-y-1">
                <Label htmlFor={`setting-${s.key}`} className="font-semibold">
                  {s.label}
                </Label>
                {s.description && (
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  <Input
                    id={`setting-${s.key}`}
                    type="number"
                    min={1}
                    step={1}
                    value={currentVal}
                    onChange={(e) => handleChange(s.key, e.target.value)}
                    className="w-32 font-mono"
                    aria-label={s.label}
                  />
                  <Button
                    size="sm"
                    onClick={() => handleSave(s.key)}
                    disabled={saving[s.key] || values[s.key] === undefined || values[s.key] === String(s.value)}
                  >
                    {saving[s.key] ? 'Saving…' : 'Save'}
                  </Button>
                  <span className="text-sm text-muted-foreground font-mono">
                    current: <strong>{s.value}</strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
