import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useTournaments() {
  return useQuery({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });
}

export function useGolfers() {
  return useQuery({
    queryKey: ['golfers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('golfers')
        .select('*')
        .eq('active' as any, true)
        .order('world_rank');
      if (error) throw error;
      return data;
    },
  });
}

export function useBids(tournamentId: string | undefined, userId?: string) {
  return useQuery({
    queryKey: ['bids', tournamentId, userId],
    enabled: !!tournamentId,
    queryFn: async () => {
      let query = supabase.from('bids').select('*').eq('tournament_id', tournamentId!);
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useAllBids(tournamentId: string | undefined) {
  return useQuery({
    queryKey: ['all-bids', tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bids')
        .select('*, users(name)')
        .eq('tournament_id', tournamentId!);
      if (error) throw error;
      return data;
    },
  });
}

export function useShareAllocations(tournamentId?: string) {
  return useQuery({
    queryKey: ['share-allocations', tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('share_allocations')
        .select('*, users(name), golfers(name, world_rank)')
        .eq('tournament_id', tournamentId!);
      if (error) throw error;
      return data;
    },
  });
}

export function useTournamentResults(tournamentId?: string) {
  return useQuery({
    queryKey: ['tournament-results', tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournament_results')
        .select('*, golfers(name, world_rank)')
        .eq('tournament_id', tournamentId!);
      if (error) throw error;
      return data;
    },
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('settings').select('*');
      if (error) throw error;
      // Return as a convenient key→value map
      const map: Record<string, number> = {};
      data.forEach((s) => { map[s.key] = Number(s.value); });
      return map;
    },
  });
}

export function useSeasonLeaderboard() {
  return useQuery({
    queryKey: ['season-leaderboard'],
    queryFn: async () => {
      // Get all share allocations and tournament results
      const [allocRes, resultsRes, usersRes] = await Promise.all([
        supabase.from('share_allocations').select('*'),
        supabase.from('tournament_results').select('*'),
        supabase.from('users').select('*').eq('is_admin', false),
      ]);

      if (allocRes.error) throw allocRes.error;
      if (resultsRes.error) throw resultsRes.error;
      if (usersRes.error) throw usersRes.error;

      const allocations = allocRes.data;
      const results = resultsRes.data;
      const users = usersRes.data;

      // Calculate points per user
      const userPoints: Record<string, { name: string; totalPoints: number }> = {};
      for (const u of users) {
        userPoints[u.id] = { name: u.name, totalPoints: 0 };
      }

      for (const alloc of allocations) {
        const result = results.find(
          (r) => r.tournament_id === alloc.tournament_id && r.golfer_id === alloc.golfer_id
        );
        if (result && userPoints[alloc.user_id]) {
          userPoints[alloc.user_id].totalPoints += alloc.shares * result.fedex_points;
        }
      }

      return Object.entries(userPoints)
        .map(([id, data]) => ({ userId: id, ...data }))
        .sort((a, b) => b.totalPoints - a.totalPoints);
    },
  });
}
