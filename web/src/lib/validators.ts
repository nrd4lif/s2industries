import { z } from 'zod'

// Solana public key format (base58, 32-44 chars)
const solanaPublicKey = z.string().min(32).max(44)

// Trading plan creation
export const createTradingPlanSchema = z.object({
  token_mint: solanaPublicKey,
  amount_sol: z.number().positive().max(1000),  // Max 1000 SOL per trade for safety
  stop_loss_percent: z.number().min(1).max(50),  // 1-50% stop loss
  take_profit_percent: z.number().min(1).max(500),  // 1-500% take profit
})

// Activate a draft plan
export const activatePlanSchema = z.object({
  plan_id: z.string().uuid(),
})

// Cancel a plan
export const cancelPlanSchema = z.object({
  plan_id: z.string().uuid(),
})

// Wallet setup
export const setupWalletSchema = z.object({
  private_key: z.string().min(64).max(128),  // Base58 encoded private key
  label: z.string().max(100).optional(),
})

// Token search
export const searchTokenSchema = z.object({
  query: z.string().min(1).max(100),
})

export type CreateTradingPlanInput = z.infer<typeof createTradingPlanSchema>
export type ActivatePlanInput = z.infer<typeof activatePlanSchema>
export type CancelPlanInput = z.infer<typeof cancelPlanSchema>
export type SetupWalletInput = z.infer<typeof setupWalletSchema>
export type SearchTokenInput = z.infer<typeof searchTokenSchema>
