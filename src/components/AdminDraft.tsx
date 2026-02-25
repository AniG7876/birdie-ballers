import { useState } from 'react';
import { useTournaments, useAllBids, useGolfers, useSettings } from '@/hooks/useFantasyData';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Gavel } from 'lucide-react';

export default function AdminDraft() {
  const { data: tournaments } = useTournaments();
  const { data: golfers } = useGolfers();
  const { data: settings } = useSettings();
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const { data: allBids } = useAllBids(selectedTournament || undefined);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);

  const MAX_SHARES = settings?.max_shares ?? 2;

  const draftableTournaments = tournaments?.filter((t) => t.status === 'drafting') ?? [];

  const processDraft = async () => {
    if (!selectedTournament || !allBids || !golfers) return;

    setProcessing(true);

    try {
      await supabase.from('share_allocations').delete().eq('tournament_id', selectedTournament);

      const allocations: { user_id: string; tournament_id: string; golfer_id: string; shares: number }[] = [];

      for (const golfer of golfers) {
        const golferBids = allBids
          .filter((b) => b.golfer_id === golfer.id)
          .sort((a, b) => b.bid_amount - a.bid_amount);

        if (golferBids.length === 0) continue;

        let sharesRemaining = MAX_SHARES;

        let i = 0;
        while (i < golferBids.length && sharesRemaining > 0) {
          const currentBidAmount = golferBids[i].bid_amount;
          const tiedBidders = golferBids.filter((b) => b.bid_amount === currentBidAmount);

          const sharesEach = Math.min(sharesRemaining, MAX_SHARES) / tiedBidders.length;
          const actualSharesEach = Math.min(sharesEach, sharesRemaining / tiedBidders.length);

          for (const bid of tiedBidders) {
            if (sharesRemaining <= 0) break;
            const shares = Math.round(actualSharesEach * 100) / 100;
            if (shares > 0) {
              allocations.push({
                user_id: bid.user_id,
                tournament_id: selectedTournament,
                golfer_id: golfer.id,
                shares,
              });
              sharesRemaining -= shares;
            }
          }

          i += tiedBidders.length;
        }
      }

      if (allocations.length > 0) {
        const { error } = await supabase.from('share_allocations').insert(allocations);
        if (error) throw error;
      }

      await supabase.from('tournaments').update({ status: 'in_progress' }).eq('id', selectedTournament);

      queryClient.invalidateQueries({ queryKey: ['share-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      toast({ title: 'Draft processed!', description: `${allocations.length} share allocations created. Max shares per golfer: ${MAX_SHARES}.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }

    setProcessing(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Gavel className="h-5 w-5" aria-hidden="true" />
          Process Draft
        </CardTitle>
        <CardDescription>
          Select a tournament in "drafting" status, then process the sealed bids to allocate golfer shares.
          Max shares per golfer: <strong>{MAX_SHARES}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {draftableTournaments.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No tournaments in "drafting" status. Change a tournament's status to "drafting" first.
          </p>
        ) : (
          <>
            <Select value={selectedTournament} onValueChange={setSelectedTournament}>
              <SelectTrigger aria-label="Select tournament to draft">
                <SelectValue placeholder="Select tournament…" />
              </SelectTrigger>
              <SelectContent>
                {draftableTournaments.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedTournament && allBids && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  {allBids.length} total bids from{' '}
                  {new Set(allBids.map((b) => b.user_id)).size} players
                </p>
                <Button onClick={processDraft} disabled={processing || allBids.length === 0}>
                  <Gavel className="h-4 w-4 mr-1" aria-hidden="true" />
                  {processing ? 'Processing…' : 'Process Draft'}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
