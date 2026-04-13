import { useShareAllocations, useTournamentResults } from '@/hooks/useFantasyData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Tables } from '@/integrations/supabase/types';

interface Props {
  tournament: Tables<'tournaments'>;
}

export default function TournamentStatus({ tournament }: Props) {
  const { data: allocations } = useShareAllocations(tournament.id);
  const { data: results } = useTournamentResults(tournament.id);

  // Group allocations by golfer
  const golferAllocations: Record<string, { golferName: string; rank: number; users: { name: string; shares: number }[] }> = {};

  allocations?.forEach((a: any) => {
    const gId = a.golfer_id;
    if (!golferAllocations[gId]) {
      golferAllocations[gId] = {
        golferName: a.golfers?.name ?? 'Unknown',
        rank: a.golfers?.world_rank ?? 99,
        users: [],
      };
    }
    golferAllocations[gId].users.push({ name: a.users?.name ?? '?', shares: a.shares });
  });

  const sortedGolfers = Object.entries(golferAllocations).sort((a, b) => a[1].rank - b[1].rank);

  // Get results map
  const resultsMap: Record<string, { position: number | null; score: string | null; fedex_points: number }> = {};
  results?.forEach((r: any) => {
    resultsMap[r.golfer_id] = { position: r.position, score: r.score, fedex_points: r.fedex_points };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {tournament.name} — {tournament.status === 'completed' ? 'Results' : 'Live'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedGolfers.length === 0 ? (
          <p className="text-muted-foreground text-sm">Draft hasn't been processed yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <caption className="sr-only">Share allocations and results for {tournament.name}</caption>
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-3 font-semibold text-muted-foreground" scope="col">Golfer</th>
                  <th className="text-left py-2 pr-3 font-semibold text-muted-foreground" scope="col">Owners</th>
                  <th className="text-right py-2 pr-3 font-semibold text-muted-foreground" scope="col">Pos</th>
                  <th className="text-right py-2 pr-3 font-semibold text-muted-foreground" scope="col">Score</th>
                  <th className="text-right py-2 font-semibold text-muted-foreground" scope="col">Points</th>
                </tr>
              </thead>
              <tbody>
                {sortedGolfers.map(([gId, g]) => {
                  const res = resultsMap[gId];
                  return (
                    <tr key={gId} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <span className="font-mono text-xs text-muted-foreground mr-1">#{g.rank}</span>
                        {g.golferName}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {g.users.map((u) => `${u.name} (${u.shares})`).join(', ')}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">{res?.position ?? '—'}</td>
                      <td className="py-2 pr-3 text-right font-mono font-medium">{res?.score ?? '—'}</td>
                      <td className="py-2 text-right font-mono font-medium">{res?.fedex_points?.toFixed(1) ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
