import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Users } from 'lucide-react';

function useAllGolfers() {
  return useQuery({
    queryKey: ['all-golfers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('golfers')
        .select('*')
        .order('world_rank');
      if (error) throw error;
      return data;
    },
  });
}

export default function AdminGolfers() {
  const { data: golfers, isLoading } = useAllGolfers();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const handleImport = async () => {
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-top-golfers');
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['all-golfers'] });
      queryClient.invalidateQueries({ queryKey: ['golfers'] });
      toast({ title: 'Import complete', description: `${data?.upserted ?? 0} golfers synced from world rankings.` });
    } catch (err: any) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    }
    setImporting(false);
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    setToggling(id);
    const { error } = await supabase
      .from('golfers')
      .update({ active: !currentActive } as any)
      .eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['all-golfers'] });
      queryClient.invalidateQueries({ queryKey: ['golfers'] });
    }
    setToggling(null);
  };

  const activeCount = golfers?.filter((g) => (g as any).active).length ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-lg">Golfer Pool</CardTitle>
          <CardDescription>
            Import the top 100 world-ranked golfers, then check the ones available for bidding.{' '}
            <span className="font-medium text-foreground">{activeCount} selected</span>
          </CardDescription>
        </div>
        <Button onClick={handleImport} disabled={importing} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${importing ? 'animate-spin' : ''}`} aria-hidden="true" />
          {importing ? 'Importing…' : 'Import Top 100'}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : !golfers?.length ? (
          <div className="text-center py-10 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No golfers yet. Click "Import Top 100" to fetch world rankings.</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
            {golfers.map((g) => {
              const isActive = (g as any).active ?? false;
              return (
                <div
                  key={g.id}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${
                    isActive ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50'
                  }`}
                >
                  <Checkbox
                    id={`golfer-${g.id}`}
                    checked={isActive}
                    disabled={toggling === g.id}
                    onCheckedChange={() => toggleActive(g.id, isActive)}
                    aria-label={`${isActive ? 'Deactivate' : 'Activate'} ${g.name}`}
                  />
                  <Label
                    htmlFor={`golfer-${g.id}`}
                    className="flex flex-1 items-center gap-2 cursor-pointer"
                  >
                    <span className="font-mono text-xs text-muted-foreground w-6 text-right">
                      #{g.world_rank}
                    </span>
                    <span className={`flex-1 ${isActive ? 'font-medium' : ''}`}>{g.name}</span>
                    {isActive && (
                      <span className="text-xs text-primary font-medium">In pool</span>
                    )}
                  </Label>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
