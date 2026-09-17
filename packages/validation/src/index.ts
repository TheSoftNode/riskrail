import { z } from 'zod';

export const stacksAddressSchema = z.string().regex(/^(SP|ST)[0-9A-HJKMNP-TV-Z]{38,41}$/);

export const stressScenarioSchema = z.object({
  address: stacksAddressSchema,
  shocks: z.array(z.object({ assetId: z.string().min(1), changeBps: z.number().int().min(-10_000).max(100_000) })).min(1),
});

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  STACKS_API_URL: z.string().url(),
});
