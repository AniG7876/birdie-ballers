import { useSeasonLeaderboard } from '@/hooks/useFantasyData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy } from 'lucide-react';

export default function SeasonLeaderboard() {
  const { data: leaderboard, isLoading } = useSeasonLeaderboard();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-gold" aria-hidden="true" />
          Season Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : !leaderboard?.length ? (
          <p className="text-muted-foreground text-sm">No results yet. Complete a tournament to see standings.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <caption className="sr-only">Season standings</caption>
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-semibold text-muted-foreground" scope="col">Rank</th>
                  <th className="text-left py-2 pr-4 font-semibold text-muted-foreground" scope="col">Player</th>
                  <th className="text-right py-2 font-semibold text-muted-foreground" scope="col">Points</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, i) => (
                  <tr key={entry.userId} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono">
                      {i === 0 && <span className="text-gold font-bold">🥇</span>}
                      {i === 1 && <span>🥈</span>}
                      {i === 2 && <span>🥉</span>}
                      {i > 2 && <span className="text-muted-foreground">{i + 1}</span>}
                    </td>
                    <td className="py-2 pr-4 font-medium">{entry.name}</td>
                    <td className="py-2 text-right font-mono">{entry.totalPoints.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
