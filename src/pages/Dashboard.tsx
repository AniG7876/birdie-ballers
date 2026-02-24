import { useState } from 'react';
import AppHeader from '@/components/AppHeader';
import SeasonLeaderboard from '@/components/SeasonLeaderboard';
import TournamentSelector from '@/components/TournamentSelector';
import BidEntry from '@/components/BidEntry';
import TournamentStatus from '@/components/TournamentStatus';
import { useTournaments } from '@/hooks/useFantasyData';

export default function Dashboard() {
  const { data: tournaments, isLoading } = useTournaments();
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | undefined>();

  const selectedTournament = tournaments?.find((t) => t.id === selectedTournamentId);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-6 space-y-6">
        <h1 className="sr-only">Fantasy Golf Dashboard</h1>

        <SeasonLeaderboard />

        <section aria-labelledby="tournament-section">
          <h2 id="tournament-section" className="text-xl font-bold mb-3">
            Tournaments
          </h2>
          {isLoading ? (
            <p className="text-muted-foreground">Loading tournaments…</p>
          ) : (
            <>
              <TournamentSelector
                tournaments={tournaments ?? []}
                selectedId={selectedTournamentId}
                onSelect={setSelectedTournamentId}
              />

              {selectedTournament && (
                <div className="mt-4 animate-fade-in space-y-4">
                  {selectedTournament.status === 'bidding' && (
                    <BidEntry tournament={selectedTournament} />
                  )}
                  {(selectedTournament.status === 'in_progress' ||
                    selectedTournament.status === 'completed' ||
                    selectedTournament.status === 'drafting') && (
                    <TournamentStatus tournament={selectedTournament} />
                  )}
                  {selectedTournament.status === 'upcoming' && (
                    <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
                      <p>This tournament hasn't opened for bidding yet.</p>
                      <p className="text-sm mt-1">
                        {selectedTournament.start_date} – {selectedTournament.end_date}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
