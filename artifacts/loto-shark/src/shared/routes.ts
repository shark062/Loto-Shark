import { z } from 'zod';

export const LotteryGameSchema = z.object({
  id: z.number().optional(),
  type: z.string(),
  contestNumber: z.number().optional(),
  drawnNumbers: z.array(z.number()).optional(),
  prizeAmount: z.string().optional(),
  drawDate: z.string().optional(),
  createdAt: z.string().optional(),
});

export const GeneratedGameSchema = z.object({
  id: z.number().optional(),
  userId: z.string().optional(),
  lotteryId: z.string().optional(),
  selectedNumbers: z.array(z.number()),
  strategy: z.string().optional(),
  contestNumber: z.number().optional(),
  createdAt: z.string().optional(),
});

export type LotteryGame = z.infer<typeof LotteryGameSchema>;
export type GeneratedGame = z.infer<typeof GeneratedGameSchema>;

export const GenerateNumbersRequestSchema = z.object({
  gameType: z.string(),
  quantity: z.number().min(0).max(60),
  amountOfGames: z.number().min(1).max(50),
  strategy: z.enum(["hot", "cold", "mixed", "random"]),
});

export const CreateGeneratedGameRequestSchema = z.object({
  lotteryId: z.string(),
  selectedNumbers: z.array(z.number()),
  strategy: z.string().optional(),
  contestNumber: z.number().optional(),
});

export type GenerateNumbersRequest = z.infer<typeof GenerateNumbersRequestSchema>;
export type CreateGeneratedGameRequest = z.infer<typeof CreateGeneratedGameRequestSchema>;

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  lottery: {
    list: {
      method: 'GET' as const,
      path: '/api/lottery/games',
      input: z.object({
        type: z.string().optional(),
        limit: z.coerce.number().optional().default(20),
      }).optional(),
      responses: {
        200: z.array(LotteryGameSchema),
      },
    },
    latest: {
      method: 'GET' as const,
      path: '/api/lottery/latest/:type',
      responses: {
        200: LotteryGameSchema,
        404: errorSchemas.notFound,
      },
    },
    analyze: {
      method: 'GET' as const,
      path: '/api/lottery/analyze/:type',
      responses: {
        200: z.object({
          recommendation: z.string(),
          stats: z.object({
            hotNumbers: z.array(z.number()),
            coldNumbers: z.array(z.number()),
            rareNumbers: z.array(z.number()),
            frequencyMap: z.record(z.number()),
          }),
        }),
      },
    },
    generate: {
      method: 'POST' as const,
      path: '/api/lottery/generate',
      input: GenerateNumbersRequestSchema,
      responses: {
        200: z.array(z.object({
          numbers: z.array(z.number()),
          strategy: z.string(),
        })),
      },
    },
  },
  userGames: {
    list: {
      method: 'GET' as const,
      path: '/api/user/games',
      responses: {
        200: z.array(GeneratedGameSchema),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/user/games',
      input: CreateGeneratedGameRequestSchema,
      responses: {
        201: GeneratedGameSchema,
      },
    },
    check: {
      method: 'POST' as const,
      path: '/api/user/games/check',
      responses: {
        200: z.object({
          updatedCount: z.number(),
        }),
      },
    }
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export const ws = {
  send: {
    subscribe: z.object({ gameType: z.string() }),
  },
  receive: {
    liveUpdate: z.object({
      type: z.string(),
      data: LotteryGameSchema,
      message: z.string(),
    }),
  },
};
