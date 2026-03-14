import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTournaments, useGolfers, useSettings } from '@/hooks/useFantasyData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { ClipboardList, Trophy, Pencil, Trash2, Check, X, RefreshCw, Gavel } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedTournament, setSelectedTournament] = useState<string>('');
  // editingBidId → draft amount string while editing
  const [editState, setEditState] = useState<Record<string, string>>({});
  const [savingBid, setSavingBid] = useState<string | null>(null);
  const [deletingBid, setDeletingBid] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState(false);

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
          shares: Number(a.shares),
          bidAmount: gBids.find((b) => b.user_id === a.user_id)?.bid_amount ?? 0,
        })),
      });
    }
    return result;
  }, [bidsByGolfer, allocationsByGolfer, bids, allocations, userMap, MAX_SHARES]);

  const selectedT = tournaments?.find((t) => t.id === selectedTournament);
  const isDrafted = selectedT && !['upcoming', 'bidding'].includes(selectedT.status);

  // --- Bid editing helpers ---
  const startEdit = (bidId: string, currentAmount: number) => {
    setEditState((prev) => ({ ...prev, [bidId]: String(currentAmount) }));
  };
  const cancelEdit = (bidId: string) => {
    setEditState((prev) => {
      const next = { ...prev };
      delete next[bidId];
      return next;
    });
  };

  const saveBid = useCallback(async (bidId: string) => {
    const newAmount = parseInt(editState[bidId] ?? '', 10);
    if (isNaN(newAmount) || newAmount < 0) {
      toast({ title: 'Invalid amount', description: 'Enter a non-negative integer.', variant: 'destructive' });
      return;
    }
    setSavingBid(bidId);
    const { error } = await supabase.from('bids').update({ bid_amount: newAmount }).eq('id', bidId);
    setSavingBid(null);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } else {
      cancelEdit(bidId);
      queryClient.invalidateQueries({ queryKey: ['audit-bids', selectedTournament] });
      toast({ title: 'Bid updated' });
    }
  }, [editState, selectedTournament, queryClient, toast]);

  const deleteBid = useCallback(async (bidId: string) => {
    setDeletingBid(bidId);
    const { error } = await supabase.from('bids').delete().eq('id', bidId);
    setDeletingBid(null);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['audit-bids', selectedTournament] });
      toast({ title: 'Bid deleted' });
    }
  }, [selectedTournament, queryClient, toast]);

  // --- Re-run draft ---
  const rerunDraft = useCallback(async () => {
    if (!selectedTournament || !bids || !golfers) return;
    setRerunning(true);
    try {
      // Clear existing allocations for this tournament
      await supabase.from('share_allocations').delete().eq('tournament_id', selectedTournament);

      const allocationsToInsert: { user_id: string; tournament_id: string; golfer_id: string; shares: number }[] = [];

      for (const golfer of golfers) {
        const golferBids = bids
          .filter((b) => b.golfer_id === golfer.id)
          .sort((a, b) => b.bid_amount - a.bid_amount);

        if (golferBids.length === 0) continue;

        const uniqueBidderCount = new Set(golferBids.map((b) => b.user_id)).size;
        if (uniqueBidderCount === 1) {
          allocationsToInsert.push({
            user_id: golferBids[0].user_id,
            tournament_id: selectedTournament,
            golfer_id: golfer.id,
            shares: 1,
          });
          continue;
        }

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
              allocationsToInsert.push({
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

      if (allocationsToInsert.length > 0) {
        const { error } = await supabase.from('share_allocations').insert(allocationsToInsert);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['audit-allocations', selectedTournament] });
      queryClient.invalidateQueries({ queryKey: ['share-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['share-allocations-leaderboard', selectedTournament] });
      toast({
        title: 'Draft re-processed',
        description: `${allocationsToInsert.length} share allocations recalculated.`,
      });
    } catch (err: any) {
      toast({ title: 'Re-run failed', description: err.message, variant: 'destructive' });
    }
    setRerunning(false);
  }, [selectedTournament, bids, golfers, MAX_SHARES, queryClient, toast]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
            Bid Audit
          </CardTitle>
          <CardDescription>
            View, edit, and delete bids for any tournament, then re-run the draft to recalculate share allocations.
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
          {/* Section A — Raw Bids (editable) */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Raw Bids</CardTitle>
                  <CardDescription>
                    {bids?.length ?? 0} bids from {new Set(bids?.map((b) => b.user_id)).size} players.
                    Click the pencil icon to edit a bid amount, or the trash icon to delete it.
                  </CardDescription>
                </div>
                {isDrafted && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={rerunDraft}
                    disabled={rerunning}
                    className="shrink-0 flex items-center gap-1.5"
                  >
                    {rerunning ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Gavel className="h-3.5 w-3.5" />
                    )}
                    {rerunning ? 'Re-running…' : 'Re-run Draft'}
                  </Button>
                )}
              </div>
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
                            <TableHead className="h-8 text-xs w-20" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gBids.map((bid) => {
                            const isEditing = bid.id in editState;
                            const isSaving = savingBid === bid.id;
                            const isDeleting = deletingBid === bid.id;
                            return (
                              <TableRow key={bid.id}>
                                <TableCell className="py-1.5 text-sm">
                                  {userMap.get(bid.user_id) ?? bid.user_id}
                                </TableCell>
                                <TableCell className="py-1.5 text-sm text-right font-mono">
                                  {isEditing ? (
                                    <Input
                                      type="number"
                                      min={0}
                                      value={editState[bid.id]}
                                      onChange={(e) =>
                                        setEditState((prev) => ({ ...prev, [bid.id]: e.target.value }))
                                      }
                                      className="h-7 w-24 text-right font-mono ml-auto"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveBid(bid.id);
                                        if (e.key === 'Escape') cancelEdit(bid.id);
                                      }}
                                      autoFocus
                                    />
                                  ) : (
                                    bid.bid_amount
                                  )}
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <div className="flex items-center justify-end gap-1">
                                    {isEditing ? (
                                      <>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-6 w-6 text-success"
                                          onClick={() => saveBid(bid.id)}
                                          disabled={isSaving}
                                          aria-label="Save bid"
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-6 w-6"
                                          onClick={() => cancelEdit(bid.id)}
                                          disabled={isSaving}
                                          aria-label="Cancel edit"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                          onClick={() => startEdit(bid.id, bid.bid_amount)}
                                          aria-label="Edit bid"
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                          onClick={() => deleteBid(bid.id)}
                                          disabled={isDeleting}
                                          aria-label="Delete bid"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
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
