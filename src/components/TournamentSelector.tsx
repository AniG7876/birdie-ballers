import type { Tables } from '@/integrations/supabase/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

type Tournament = Tables<'tournaments'>;

const statusColors: Record<string, string> = {
  upcoming: 'bg-muted text-muted-foreground',
  bidding: 'bg-accent text-accent-foreground',
  drafting: 'bg-secondary text-secondary-foreground',
  in_progress: 'bg-success text-success-foreground',
  completed: 'bg-primary text-primary-foreground',
};

interface Props {
  tournaments: Tournament[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

export default function TournamentSelector({ tournaments, selectedId, onSelect }: Props) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
      <Select value={selectedId ?? ''} onValueChange={onSelect}>
        <SelectTrigger className="w-full sm:w-80" aria-label="Select a tournament">
          <SelectValue placeholder="Choose a tournament…" />
        </SelectTrigger>
        <SelectContent>
          {tournaments.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              <span className="flex items-center gap-2">
                {t.name}
                <Badge variant="outline" className={`text-xs ${statusColors[t.status] ?? ''}`}>
                  {t.status.replace('_', ' ')}
                </Badge>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
