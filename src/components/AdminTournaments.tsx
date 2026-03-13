import { useTournaments } from '@/hooks/useFantasyData';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  // Per-tournament editing state for slash golf IDs
  const [editingSlash, setEditingSlash] = useState<Record<string, { tournId: string; year: string }>>({});

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

  const saveSlashGolfIds = async (tournamentId: string) => {
    const vals = editingSlash[tournamentId];
    if (!vals) return;
    const { error } = await supabase
      .from('tournaments')
      .update({ slash_golf_tourn_id: vals.tournId || null, slash_golf_year: vals.year || null } as any)
      .eq('id', tournamentId);
    if (error) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setEditingSlash((prev) => { const n = { ...prev }; delete n[tournamentId]; return n; });
      toast({ title: 'Slash Golf IDs saved' });
    }
  };

  const updateScores = async (tournament: any) => {
    const slashTournId = editingSlash[tournament.id]?.tournId ?? tournament.slash_golf_tourn_id;
    const slashYear = editingSlash[tournament.id]?.year ?? tournament.slash_golf_year;

    if (!slashTournId || !slashYear) {
      toast({ title: 'Slash Golf IDs missing', description: 'Set Tournament ID and Year first.', variant: 'destructive' });
      return;
    }
    setUpdatingScores(tournament.id);

    try {
      const { data, error } = await supabase.functions.invoke('fetch-slashgolf-scores', {
        body: {
          tournamentId: tournament.id,
          slashGolfTournId: slashTournId,
          slashGolfYear: slashYear,
        },
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
        <div className="space-y-4">
          {tournaments?.map((t) => {
            const bidCount = bidCounts?.[t.id] ?? 0;
            const isBidding = t.status === 'bidding';
            const tAny = t as any;
            const slashState = editingSlash[t.id];
            const currentTournId = slashState?.tournId ?? tAny.slash_golf_tourn_id ?? '';
            const currentYear = slashState?.year ?? tAny.slash_golf_year ?? '';
            const isDirty = !!slashState;
            const canScore = t.status === 'in_progress' || t.status === 'completed';

            return (
              <div key={t.id} className="flex flex-col gap-3 p-3 rounded-md bg-muted/50 border">
                {/* Top row: name + controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
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
                      onClick={() => toggleHidden(t.id, tAny.hidden ?? false)}
                      aria-label={`${tAny.hidden ? 'Show' : 'Hide'} ${t.name}`}
                      title={`${tAny.hidden ? 'Show to users' : 'Hide from users'}`}
                    >
                      {tAny.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Slash Golf config row */}
                <div className="flex flex-wrap items-center gap-2 pl-1">
                  <span className="text-xs text-muted-foreground w-28 shrink-0">Slash Golf ID:</span>
                  <Input
                    className="h-7 text-xs w-28"
                    placeholder="e.g. 006"
                    value={currentTournId}
                    onChange={(e) =>
                      setEditingSlash((prev) => ({
                        ...prev,
                        [t.id]: { tournId: e.target.value, year: currentYear },
                      }))
                    }
                  />
                  <span className="text-xs text-muted-foreground">Year:</span>
                  <Input
                    className="h-7 text-xs w-20"
                    placeholder="2026"
                    value={currentYear}
                    onChange={(e) =>
                      setEditingSlash((prev) => ({
                        ...prev,
                        [t.id]: { tournId: currentTournId, year: e.target.value },
                      }))
                    }
                  />
                  {isDirty && (
                    <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => saveSlashGolfIds(t.id)}>
                      Save
                    </Button>
                  )}
                  {canScore && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => updateScores(t)}
                      disabled={updatingScores === t.id}
                      aria-label={`Update scores for ${t.name}`}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 mr-1 ${updatingScores === t.id ? 'animate-spin' : ''}`} aria-hidden="true" />
                      {updatingScores === t.id ? 'Updating…' : 'Update Scores'}
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
