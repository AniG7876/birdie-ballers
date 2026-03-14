import { useState } from 'react';
import AppHeader from '@/components/AppHeader';
import SeasonLeaderboard from '@/components/SeasonLeaderboard';
import BidEntry from '@/components/BidEntry';
import TournamentStatus from '@/components/TournamentStatus';
import LiveLeaderboard from '@/components/LiveLeaderboard';
import TournamentScheduleGrid from '@/components/TournamentScheduleGrid';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useTournaments } from '@/hooks/useFantasyData';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const { data: tournaments, isLoading } = useTournaments();
  const [selectedFantasyId, setSelectedFantasyId] = useState<string | null>(null);

  const visibleTournaments = tournaments?.filter((t) => !(t as any).hidden) ?? [];

  // Active (in_progress) tournament for the live leaderboard
  const activeTournament = visibleTournaments.find((t) => t.status === 'in_progress');

  // Fantasy tab: tournaments open for bidding
  const biddingTournaments = visibleTournaments.filter((t) => t.status === 'bidding');

  // Fantasy tab: past drafted tournaments (completed or in_progress)
  const draftedTournaments = visibleTournaments.filter(
    (t) => t.status === 'completed' || t.status === 'in_progress' || t.status === 'drafting'
  );

  const selectedTournament = selectedFantasyId
    ? visibleTournaments.find((t) => t.id === selectedFantasyId)
    : null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-6">
        <h1 className="sr-only">Birdie Ballers Fantasy Golf</h1>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full mb-6 grid grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="fantasy">Fantasy Golf</TabsTrigger>
          </TabsList>

          {/* ── OVERVIEW TAB ── */}
          <TabsContent value="overview" className="space-y-8">
            {/* Live Leaderboard */}
            {isLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : activeTournament ? (
              <LiveLeaderboard
                tournamentId={activeTournament.id}
                tournamentName={activeTournament.name}
                slashGolfTournId={(activeTournament as any).slash_golf_tourn_id}
                slashGolfYear={(activeTournament as any).slash_golf_year}
              />
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>Leaderboard</h2>
                </div>
                <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
                  No tournament is currently in progress.
                </div>
              </div>
            )}

            {/* Tournament Schedule */}
            {!isLoading && (
              <TournamentScheduleGrid tournaments={visibleTournaments} />
            )}
          </TabsContent>

          {/* ── FANTASY GOLF TAB ── */}
          <TabsContent value="fantasy" className="space-y-6">
            {isLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : selectedTournament ? (
              /* Detail view for a selected tournament */
              <div className="space-y-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1 -ml-2 text-muted-foreground"
                  onClick={() => setSelectedFantasyId(null)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>

                {selectedTournament.status === 'bidding' && (
                  <BidEntry tournament={selectedTournament} />
                )}
                {(selectedTournament.status === 'in_progress' ||
                  selectedTournament.status === 'completed' ||
                  selectedTournament.status === 'drafting') && (
                  <TournamentStatus tournament={selectedTournament} />
                )}
              </div>
            ) : (
              <>
                {/* Season Leaderboard */}
                <SeasonLeaderboard />

                {/* Bidding Open */}
                {biddingTournaments.length > 0 && (
                  <section>
                    <h2 className="text-lg font-bold mb-3" style={{ fontFamily: 'Georgia, serif' }}>
                      Open for Bidding
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {biddingTournaments.map((t) => (
                        <TournamentCard
                          key={t.id}
                          tournament={t}
                          label="Bidding Open"
                          labelClass="bg-accent text-accent-foreground"
                          description="Submit your bids before the draft closes."
                          onClick={() => setSelectedFantasyId(t.id)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Past Drafted Tournaments */}
                {draftedTournaments.length > 0 && (
                  <section>
                    <h2 className="text-lg font-bold mb-3" style={{ fontFamily: 'Georgia, serif' }}>
                      Draft Results
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {draftedTournaments.map((t) => (
                        <TournamentCard
                          key={t.id}
                          tournament={t}
                          label={t.status === 'completed' ? 'Completed' : t.status === 'in_progress' ? 'Live' : 'Drafting'}
                          labelClass={
                            t.status === 'completed'
                              ? 'bg-primary text-primary-foreground'
                              : t.status === 'in_progress'
                              ? 'bg-success text-success-foreground'
                              : 'bg-secondary text-secondary-foreground'
                          }
                          description="View share allocations and live results."
                          onClick={() => setSelectedFantasyId(t.id)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {biddingTournaments.length === 0 && draftedTournaments.length === 0 && (
                  <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
                    No active fantasy tournaments yet. Check back when bidding opens.
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ── Small reusable tournament card ── */
interface CardProps {
  tournament: { id: string; name: string; start_date: string; end_date: string };
  label: string;
  labelClass: string;
  description: string;
  onClick: () => void;
}

function TournamentCard({ tournament, label, labelClass, description, onClick }: CardProps) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-lg border bg-card p-4 flex flex-col gap-2 hover:shadow-md hover:border-primary/40 transition-all w-full"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-base leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
          {tournament.name}
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${labelClass}`}>
          {label}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {formatDate(tournament.start_date)} – {formatDate(tournament.end_date)}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </button>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
