import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type GenerateNumbersRequest, type CreateGeneratedGameRequest } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useLotteryGames(type?: string) {
  return useQuery({
    queryKey: [api.lottery.list.path, type],
    queryFn: async () => {
      // Correctly constructing query params based on input schema
      const url = new URL(api.lottery.list.path, window.location.origin);
      if (type) url.searchParams.set("type", type);
      
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch lottery games");
      return api.lottery.list.responses[200].parse(await res.json());
    },
  });
}

export function useLatestResult(type: string) {
  return useQuery({
    queryKey: [api.lottery.latest.path, type],
    queryFn: async () => {
      const url = buildUrl(api.lottery.latest.path, { type });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch latest result");
      return api.lottery.latest.responses[200].parse(await res.json());
    },
    enabled: !!type,
  });
}

export function useAnalysis(type: string) {
  return useQuery({
    queryKey: [api.lottery.analyze.path, type],
    queryFn: async () => {
      const url = buildUrl(api.lottery.analyze.path, { type });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch analysis");
      return api.lottery.analyze.responses[200].parse(await res.json());
    },
    enabled: !!type,
  });
}

export function useGenerateNumbers() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: GenerateNumbersRequest) => {
      const res = await fetch(api.lottery.generate.path, {
        method: api.lottery.generate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to generate numbers");
      return api.lottery.generate.responses[200].parse(await res.json());
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUserGames() {
  return useQuery({
    queryKey: [api.userGames.list.path],
    queryFn: async () => {
      const res = await fetch(api.userGames.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch your games");
      return api.userGames.list.responses[200].parse(await res.json());
    },
  });
}

export function useSaveGame() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: CreateGeneratedGameRequest) => {
      const res = await fetch(api.userGames.create.path, {
        method: api.userGames.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to save game");
      return api.userGames.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.userGames.list.path] });
      toast({
        title: "Game Saved!",
        description: "Your game has been saved to history.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not save game. Try again.",
        variant: "destructive",
      });
    }
  });
}

export function useCheckGames() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.userGames.check.path, {
        method: api.userGames.check.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to check games");
      return api.userGames.check.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.userGames.list.path] });
      toast({
        title: "Games Checked",
        description: `Updated ${data.updatedCount} games with latest results.`,
      });
    }
  });
}
