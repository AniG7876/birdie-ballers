import { useTournaments, useAllBids } from '@/hooks/useFantasyData';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, EyeOff, Eye, FileText } from 'lucide-react';
import { useState } from 'react';

const STATUSES = ['upcoming', 'bidding', 'drafting', 'in_progress', 'completed'] as const;

function useBidCounts() {
  return useQuery({
    queryKey: ['bid-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bids')
        .select('tournament_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const bid of data) {
        counts[bid.tournament_id] = (counts[bid.tournament_id] ?? 0) + 1;
      }
      return counts;
    },
  });
}

export default function AdminTournaments() {
  const { data: tournaments, isLoading } = useTournaments();
  const { data: bidCounts } = useBidCounts();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [updatingScores, setUpdatingScores] = useState<string | null>(null);

  const toggleHidden = async (id: string, hidden: boolean) => {
    const { error } = await supabase.from('tournaments').update({ hidden: !hidden } as any).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      toast({ title: !hidden ? 'Tournament hidden' : 'Tournament visible' });
    }
  };

  const changeStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('tournaments').update({ status }).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['bid-counts'] });
      toast({ title: 'Status updated' });
    }
  };

  const updateScores = async (tournament: any) => {
    if (!tournament.espn_event_id) {
      toast({ title: 'No ESPN event ID', variant: 'destructive' });
      return;
    }
    setUpdatingScores(tournament.id);

    try {
      const { data, error } = await supabase.functions.invoke('fetch-espn-scores', {
        body: { tournamentId: tournament.id, espnEventId: tournament.espn_event_id },
      });

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['tournament-results'] });
      queryClient.invalidateQueries({ queryKey: ['season-leaderboard'] });
      toast({ title: 'Scores updated', description: `Updated ${data?.updated ?? 0} golfer scores.` });
    } catch (err: any) {
      toast({ title: 'Error updating scores', description: err.message, variant: 'destructive' });
    }
    setUpdatingScores(null);
  };

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tournament Management</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tournaments?.map((t) => {
            const bidCount = bidCounts?.[t.id] ?? 0;
            const isBidding = t.status === 'bidding';
            return (
              <div key={t.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 rounded-md bg-muted/50 border">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.start_date} – {t.end_date}</p>
                  {isBidding && (
                    <div className="flex items-center gap-1 mt-1">
                      <FileText className="h-3 w-3 text-primary" />
                      <span className="text-xs font-medium text-primary">
                        {bidCount} bid{bidCount !== 1 ? 's' : ''} submitted
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Select value={t.status} onValueChange={(val) => changeStatus(t.id, val)}>
                    <SelectTrigger className="w-36" aria-label={`Change status for ${t.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          <Badge variant="outline" className="text-xs">{s.replace('_', ' ')}</Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleHidden(t.id, (t as any).hidden ?? false)}
                    aria-label={`${(t as any).hidden ? 'Show' : 'Hide'} ${t.name}`}
                    title={`${(t as any).hidden ? 'Show to users' : 'Hide from users'}`}
                  >
                    {(t as any).hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  {(t.status === 'in_progress' || t.status === 'completed') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateScores(t)}
                      disabled={updatingScores === t.id}
                      aria-label={`Update scores for ${t.name}`}
                    >
                      <RefreshCw className={`h-4 w-4 ${updatingScores === t.id ? 'animate-spin' : ''}`} aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
