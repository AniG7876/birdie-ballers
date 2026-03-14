import type { Tables } from '@/integrations/supabase/types';
import { Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type Tournament = Tables<'tournaments'>;

const statusLabel: Record<string, string> = {
  upcoming: 'Coming Soon',
  bidding: 'Bidding Open',
  drafting: 'Drafting',
  in_progress: 'Active',
  completed: 'Completed',
};

const statusStyle: Record<string, string> = {
  upcoming: 'bg-muted text-muted-foreground',
  bidding: 'bg-accent text-accent-foreground',
  drafting: 'bg-secondary text-secondary-foreground',
  in_progress: 'bg-success text-success-foreground',
  completed: 'bg-primary text-primary-foreground',
};

interface Props {
  tournaments: Tournament[];
}

export default function TournamentScheduleGrid({ tournaments }: Props) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Georgia, serif' }}>Tournament Schedule</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tournaments.map((t) => (
          <div
            key={t.id}
            className="rounded-lg border bg-card p-4 flex flex-col gap-2 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-base leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
                {t.name}
              </h3>
              <Badge
                variant="outline"
                className={`text-xs shrink-0 ${statusStyle[t.status] ?? 'bg-muted text-muted-foreground'}`}
              >
                {statusLabel[t.status] ?? t.status}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>
                {formatDate(t.start_date)} – {formatDate(t.end_date)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
