import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTournaments, useGolfers, useSettings } from '@/hooks/useFantasyData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { ClipboardList, Trophy } from 'lucide-react';

function useAllBidsForTournament(tournamentId?: string) {
  return useQuery({
    queryKey: ['audit-bids', tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bids')
        .select('*')
        .eq('tournament_id', tournamentId!);
      if (error) throw error;
      return data;
    },
  });
}

function useAllUsers() {
  return useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('id, name');
      if (error) throw error;
      return data;
    },
  });
}

function useShareAllocationsForTournament(tournamentId?: string) {
  return useQuery({
    queryKey: ['audit-allocations', tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('share_allocations')
        .select('*')
        .eq('tournament_id', tournamentId!);
      if (error) throw error;
      return data;
    },
  });
}

export default function AdminBidAudit() {
  const { data: tournaments } = useTournaments();
  const { data: golfers } = useGolfers();
  const { data: settings } = useSettings();
  const { data: users } = useAllUsers();
  const [selectedTournament, setSelectedTournament] = useState<string>('');

  const { data: bids } = useAllBidsForTournament(selectedTournament || undefined);
  const { data: allocations } = useShareAllocationsForTournament(selectedTournament || undefined);

  const MAX_SHARES = settings?.max_shares ?? 2;

  const golferMap = useMemo(() => new Map((golfers ?? []).map((g) => [g.id, g.name])), [golfers]);
  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u.id, u.name])), [users]);

  // Group bids by golfer, sorted by bid amount desc
  const bidsByGolfer = useMemo(() => {
    if (!bids) return [];
    const map = new Map<string, typeof bids>();
    for (const bid of bids) {
      if (!map.has(bid.golfer_id)) map.set(bid.golfer_id, []);
      map.get(bid.golfer_id)!.push(bid);
    }
    const result: { golferId: string; golferName: string; bids: typeof bids }[] = [];
    for (const [golferId, gBids] of map.entries()) {
      result.push({
        golferId,
        golferName: golferMap.get(golferId) ?? golferId,
        bids: [...gBids].sort((a, b) => b.bid_amount - a.bid_amount),
      });
    }
    return result.sort((a, b) => a.golferName.localeCompare(b.golferName));
  }, [bids, golferMap]);

  // Group allocations by golfer
  const allocationsByGolfer = useMemo(() => {
    if (!allocations) return new Map<string, typeof allocations>();
    const map = new Map<string, typeof allocations>();
    for (const alloc of allocations) {
      if (!map.has(alloc.golfer_id)) map.set(alloc.golfer_id, []);
      map.get(alloc.golfer_id)!.push(alloc);
    }
    return map;
  }, [allocations]);

  // Compute draft explanation per golfer
  const draftExplanation = useMemo(() => {
    const result: {
      golferId: string;
      golferName: string;
      reason: string;
      allocations: { userId: string; userName: string; shares: number; bidAmount: number }[];
    }[] = [];

    if (!bids || !allocations) return result;

    for (const { golferId, golferName, bids: gBids } of bidsByGolfer) {
      const golferAllocs = allocationsByGolfer.get(golferId) ?? [];
      if (golferAllocs.length === 0 && gBids.length === 0) continue;

      const uniqueBidders = new Set(gBids.map((b) => b.user_id)).size;
      let reason = '';
      if (uniqueBidders === 0) {
        reason = 'No bids — no shares allocated';
      } else if (uniqueBidders === 1) {
        reason = 'Only 1 bidder → 1 share awarded (single-bid rule)';
      } else {
        const topBid = gBids[0]?.bid_amount ?? 0;
        const tied = gBids.filter((b) => b.bid_amount === topBid);
        if (tied.length > 1) {
          reason = `Top bid of ${topBid} tied by ${tied.length} players → ${MAX_SHARES} shares split equally`;
        } else {
          reason = `Highest bidder wins up to ${MAX_SHARES} shares`;
        }
      }

      result.push({
        golferId,
        golferName,
        reason,
        allocations: golferAllocs.map((a) => ({
          userId: a.user_id,
          userName: userMap.get(a.user_id) ?? a.user_id,
          shares: a.shares,
          bidAmount: gBids.find((b) => b.user_id === a.user_id)?.bid_amount ?? 0,
        })),
      });
    }
    return result;
  }, [bidsByGolfer, allocationsByGolfer, bids, allocations, userMap, MAX_SHARES]);

  const selectedT = tournaments?.find((t) => t.id === selectedTournament);
  const isDrafted = selectedT && !['upcoming', 'bidding'].includes(selectedT.status);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
            Bid Audit
          </CardTitle>
          <CardDescription>
            View all submitted bids and the exact draft outcome for any tournament.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedTournament} onValueChange={setSelectedTournament}>
            <SelectTrigger className="w-72" aria-label="Select tournament">
              <SelectValue placeholder="Select a tournament…" />
            </SelectTrigger>
            <SelectContent>
              {(tournaments ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}{' '}
                  <Badge variant="outline" className="ml-2 text-xs">
                    {t.status.replace('_', ' ')}
                  </Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedTournament && (
        <>
          {/* Section A — Raw Bids */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Raw Bids</CardTitle>
              <CardDescription>
                {bids?.length ?? 0} bids from {new Set(bids?.map((b) => b.user_id)).size} players
              </CardDescription>
            </CardHeader>
            <CardContent>
              {bidsByGolfer.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bids submitted for this tournament.</p>
              ) : (
                <div className="space-y-4">
                  {bidsByGolfer.map(({ golferId, golferName, bids: gBids }) => (
                    <div key={golferId}>
                      <p className="font-semibold text-sm mb-1">{golferName}</p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-8 text-xs">Player</TableHead>
                            <TableHead className="h-8 text-xs text-right">Bid Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gBids.map((bid) => (
                            <TableRow key={bid.id}>
                              <TableCell className="py-1.5 text-sm">
                                {userMap.get(bid.user_id) ?? bid.user_id}
                              </TableCell>
                              <TableCell className="py-1.5 text-sm text-right font-mono">
                                {bid.bid_amount}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section B — Draft Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4" aria-hidden="true" />
                Draft Results & Reasoning
              </CardTitle>
              <CardDescription>
                {isDrafted
                  ? 'How shares were allocated after the draft was processed.'
                  : 'Draft has not been processed yet for this tournament.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isDrafted ? (
                <p className="text-sm text-muted-foreground">
                  Process the draft first to see results here.
                </p>
              ) : draftExplanation.length === 0 ? (
                <p className="text-sm text-muted-foreground">No draft data found.</p>
              ) : (
                <div className="space-y-5">
                  {draftExplanation.map(({ golferId, golferName, reason, allocations: allocs }) => (
                    <div key={golferId}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-sm">{golferName}</p>
                        <span className="text-xs text-muted-foreground italic">{reason}</span>
                      </div>
                      {allocs.length === 0 ? (
                        <p className="text-xs text-muted-foreground pl-2">No shares allocated</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="h-8 text-xs">Player</TableHead>
                              <TableHead className="h-8 text-xs text-right">Bid</TableHead>
                              <TableHead className="h-8 text-xs text-right">Shares Won</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {allocs.map((a) => (
                              <TableRow key={a.userId}>
                                <TableCell className="py-1.5 text-sm">{a.userName}</TableCell>
                                <TableCell className="py-1.5 text-sm text-right font-mono">
                                  {a.bidAmount}
                                </TableCell>
                                <TableCell className="py-1.5 text-sm text-right font-semibold text-primary">
                                  {a.shares}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                      <Separator className="mt-4" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
