import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Radio } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  tournamentId: string;
  tournamentName: string;
  slashGolfTournId?: string | null;
  slashGolfYear?: string | null;
}

function useLeaderboard(tournamentId: string) {
  return useQuery({
    queryKey: ['live-leaderboard', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournament_results')
        .select('*, golfers(name, world_rank)')
        .eq('tournament_id', tournamentId)
        .order('position', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });
}

function useShareAllocations(tournamentId: string) {
  return useQuery({
    queryKey: ['share-allocations-leaderboard', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('share_allocations')
        .select('golfer_id, user_id, shares')
        .eq('tournament_id', tournamentId);
      if (error) throw error;
      return data;
    },
  });
}

function useUsers() {
  return useQuery({
    queryKey: ['users-leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('id, name');
      if (error) throw error;
      return data;
    },
  });
}

export default function LiveLeaderboard({ tournamentId, tournamentName, slashGolfTournId, slashGolfYear }: Props) {
  const { data: rows, isLoading } = useLeaderboard(tournamentId);
  const { data: allocations } = useShareAllocations(tournamentId);
  const { data: users } = useUsers();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  // Build golfer → [{ userName, shares }] map
  const ownerMap = useMemo(() => {
    if (!allocations || !users) return new Map<string, { name: string; shares: number }[]>();
    const userMap = new Map(users.map((u) => [u.id, u.name]));
    const map = new Map<string, { name: string; shares: number }[]>();
    for (const a of allocations) {
      if (!map.has(a.golfer_id)) map.set(a.golfer_id, []);
      map.get(a.golfer_id)!.push({ name: userMap.get(a.user_id) ?? 'Unknown', shares: Number(a.shares) });
    }
    return map;
  }, [allocations, users]);

  const handleRefresh = async () => {
    if (!slashGolfTournId || !slashGolfYear) {
      await queryClient.invalidateQueries({ queryKey: ['live-leaderboard', tournamentId] });
      return;
    }
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-slashgolf-scores', {
        body: { tournamentId, slashGolfTournId, slashGolfYear },
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['live-leaderboard', tournamentId] });
      toast({ title: 'Scores refreshed', description: `Updated ${data?.updated ?? 0} golfer scores.` });
    } catch (err: any) {
      toast({ title: 'Refresh failed', description: err.message, variant: 'destructive' });
    }
    setRefreshing(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>{tournamentName}</h2>
          <Badge className="bg-success text-success-foreground flex items-center gap-1 text-xs">
            <Radio className="h-3 w-3" />
            Live
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm" role="table">
          <thead className="bg-muted/30">
            <tr className="border-b">
              <th className="text-left py-2.5 px-4 font-semibold text-muted-foreground w-16" scope="col">Pos</th>
              <th className="text-left py-2.5 px-4 font-semibold text-muted-foreground" scope="col">Player</th>
              <th className="text-right py-2.5 px-4 font-semibold text-muted-foreground w-24" scope="col">Score</th>
              <th className="text-right py-2.5 px-4 font-semibold text-muted-foreground w-24 hidden sm:table-cell" scope="col">FedEx Pts</th>
              <th className="text-left py-2.5 px-4 font-semibold text-muted-foreground hidden md:table-cell" scope="col">Drafted By</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">Loading leaderboard…</td>
              </tr>
            ) : !rows || rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">
                  No leaderboard data available. Try refreshing.
                </td>
              </tr>
            ) : (
              rows.map((row: any) => {
                const scoreNum = row.score ? parseInt(row.score, 10) : null;
                const scoreClass = scoreNum !== null && !isNaN(scoreNum)
                  ? scoreNum < 0 ? 'text-success font-semibold' : scoreNum > 0 ? 'text-destructive font-semibold' : ''
                  : '';
                const owners = ownerMap.get(row.golfer_id) ?? [];
                return (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-muted-foreground">
                      {row.position != null ? `T${row.position}` : '—'}
                    </td>
                    <td className="py-2.5 px-4 font-medium">
                      {row.golfers?.name ?? 'Unknown'}
                    </td>
                    <td className={`py-2.5 px-4 text-right font-mono ${scoreClass}`}>
                      {row.score ?? '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-muted-foreground hidden sm:table-cell">
                      {row.fedex_points ? Number(row.fedex_points).toFixed(1) : '—'}
                    </td>
                    <td className="py-2.5 px-4 hidden md:table-cell">
                      {owners.length === 0 ? (
                        <span className="text-muted-foreground text-xs">Undrafted</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {owners.map((o) => (
                            <Badge
                              key={o.name}
                              variant="secondary"
                              className="text-xs font-normal"
                            >
                              {o.name} ({o.shares})
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
