import { z } from 'zod'

// Solana public key format (base58, 32-44 chars)
const solanaPublicKey = z.string().min(32).max(44)

// Trading plan creation
export const createTradingPlanSchema = z.object({
  token_mint: solanaPublicKey,
  token_symbol: z.string().max(20).optional(),  // Optional - pass from UI to avoid API lookup issues
  token_name: z.string().max(100).optional(),   // Optional - pass from UI to avoid API lookup issues
  amount_sol: z.number().positive().max(1000),  // Max 1000 SOL per trade for safety
  stop_loss_percent: z.number().min(1).max(90),  // 1-90% stop loss (high for volatile meme coins)
  take_profit_percent: z.number().min(1).max(500),  // 1-500% take profit

  // Limit buy options
  use_limit_buy: z.boolean().optional().default(false),
  target_entry_price: z.number().positive().optional(),  // Target USD price to buy at
  entry_threshold_percent: z.number().min(0.1).max(10).optional().default(1.0),  // Buy within X% of target
  max_wait_hours: z.number().min(1).max(168).optional().default(24),  // Max hours to wait (1-168, default 24)

  // Trailing stop options
  use_trailing_stop: z.boolean().optional().default(false),
  trailing_stop_percent: z.number().min(1).max(90).optional(),  // Trail X% below peak

  // Partial profit-taking options
  use_partial_profit: z.boolean().optional().default(false),
  partial_profit_percent: z.number().min(10).max(90).optional().default(50),  // Sell X% at TP1
  partial_profit_price: z.number().positive().optional(),  // TP1 price (if different from main TP)

  // Breakeven stop options
  use_breakeven_stop: z.boolean().optional().default(false),
  breakeven_trigger_percent: z.number().min(1).max(50).optional().default(3),  // Move SL to entry at X% profit

  // Time-based exit
  max_hold_hours: z.number().min(1).max(720).optional(),  // Auto-exit after X hours (max 30 days)
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

// User trading settings
export const userSettingsSchema = z.object({
  // Daily loss limits
  daily_loss_limit_sol: z.number().min(0).max(100).optional().default(0.5),
  daily_loss_limit_enabled: z.boolean().optional().default(true),

  // Position limits
  max_concurrent_trades: z.number().min(1).max(20).optional().default(5),
  max_position_size_sol: z.number().min(0.001).max(100).optional().default(1.0),

  // Default trade settings
  default_stop_loss_percent: z.number().min(1).max(50).optional().default(5),
  default_take_profit_percent: z.number().min(1).max(500).optional().default(10),
  default_use_trailing_stop: z.boolean().optional().default(false),
  default_trailing_stop_percent: z.number().min(1).max(50).optional().default(5),
  default_use_partial_profit: z.boolean().optional().default(false),
  default_use_breakeven_stop: z.boolean().optional().default(false),
  default_max_hold_hours: z.number().min(1).max(720).nullable().optional(),
})

export type CreateTradingPlanInput = z.infer<typeof createTradingPlanSchema>
export type ActivatePlanInput = z.infer<typeof activatePlanSchema>
export type CancelPlanInput = z.infer<typeof cancelPlanSchema>
export type SetupWalletInput = z.infer<typeof setupWalletSchema>
export type SearchTokenInput = z.infer<typeof searchTokenSchema>
export type UserSettingsInput = z.infer<typeof userSettingsSchema>
