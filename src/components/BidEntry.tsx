import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGolfers, useBids } from '@/hooks/useFantasyData';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

const MAX_POINTS = 10; // total credits per user per tournament
const MAX_BID = 2; // max shares per golfer
const MIN_BID = 1;

interface Props {
  tournament: Tables<'tournaments'>;
}

export default function BidEntry({ tournament }: Props) {
  const { user } = useAuth();
  const { data: golfers } = useGolfers();
  const { data: existingBids, isLoading: bidsLoading } = useBids(tournament.id, user?.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [bids, setBids] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  // Initialize bids from existing data
  useMemo(() => {
    if (existingBids?.length) {
      const map: Record<string, number> = {};
      existingBids.forEach((b) => {
        map[b.golfer_id] = b.bid_amount;
      });
      setBids(map);
    }
  }, [existingBids]);

  const totalBid = Object.values(bids).reduce((sum, v) => sum + (v || 0), 0);
  const remaining = MAX_POINTS - totalBid;

  const handleBidChange = (golferId: string, value: string) => {
    const num = parseInt(value) || 0;
    setBids((prev) => {
      if (num === 0) {
        const next = { ...prev };
        delete next[golferId];
        return next;
      }
      return { ...prev, [golferId]: Math.min(Math.max(num, 0), MAX_BID) };
    });
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (totalBid > MAX_POINTS) {
      toast({ title: 'Over budget', description: `You've used ${totalBid}/${MAX_POINTS} points.`, variant: 'destructive' });
      return;
    }

    // Validate min bid
    for (const [, amount] of Object.entries(bids)) {
      if (amount < MIN_BID || amount > MAX_BID) {
        toast({ title: 'Invalid bid', description: `Each bid must be between ${MIN_BID} and ${MAX_BID}.`, variant: 'destructive' });
        return;
      }
    }

    setSubmitting(true);

    // Delete old bids then insert new
    await supabase.from('bids').delete().eq('user_id', user.id).eq('tournament_id', tournament.id);

    const rows = Object.entries(bids).map(([golfer_id, bid_amount]) => ({
      user_id: user.id,
      tournament_id: tournament.id,
      golfer_id,
      bid_amount,
    }));

    if (rows.length > 0) {
      const { error } = await supabase.from('bids').insert(rows);
      if (error) {
        toast({ title: 'Error', description: 'Failed to submit bids.', variant: 'destructive' });
        setSubmitting(false);
        return;
      }
    }

    queryClient.invalidateQueries({ queryKey: ['bids'] });
    toast({ title: 'Bids submitted!', description: `You used ${totalBid} of ${MAX_POINTS} points.` });
    setSubmitting(false);
  };

  if (bidsLoading) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{tournament.name} — Place Your Bids</CardTitle>
        <CardDescription>
          You have <strong className={remaining < 0 ? 'text-destructive' : 'text-primary'}>{remaining}</strong> of {MAX_POINTS} points remaining.
          Bid {MIN_BID}–{MAX_BID} per golfer share. Each golfer has 10 shares total.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {golfers?.map((g) => (
            <div key={g.id} className="flex items-center gap-3">
              <Label htmlFor={`bid-${g.id}`} className="flex-1 min-w-0">
                <span className="font-mono text-xs text-muted-foreground mr-2">#{g.world_rank}</span>
                <span className="truncate">{g.name}</span>
              </Label>
              <Input
                id={`bid-${g.id}`}
                type="number"
                min={0}
                max={MAX_BID}
                value={bids[g.id] ?? ''}
                onChange={(e) => handleBidChange(g.id, e.target.value)}
                className="w-20 text-center font-mono"
                aria-label={`Bid for ${g.name}`}
              />
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Total: <span className="font-mono font-bold text-foreground">{totalBid}</span> / {MAX_POINTS}
          </p>
          <Button onClick={handleSubmit} disabled={submitting || remaining < 0}>
            {submitting ? 'Submitting…' : existingBids?.length ? 'Update Bids' : 'Submit Bids'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
