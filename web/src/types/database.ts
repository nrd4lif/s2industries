export type TradingPlanStatus = 'pending' | 'waiting_entry' | 'active' | 'completed' | 'cancelled' | 'expired'
export type TriggerType = 'stop_loss' | 'take_profit'
export type TradeSide = 'buy' | 'sell'

export interface WalletConfig {
  id: string
  user_id: string
  public_key: string
  encrypted_private_key: string
  label: string
  created_at: string
  updated_at: string
}

export interface TradingPlan {
  id: string
  user_id: string
  token_mint: string
  token_symbol: string | null
  token_name: string | null
  token_decimals: number | null
  entry_price_usd: number | null
  amount_sol: number
  amount_tokens: number | null
  stop_loss_percent: number
  take_profit_percent: number
  stop_loss_price: number | null
  take_profit_price: number | null
  status: TradingPlanStatus
  triggered_by: TriggerType | null
  triggered_at: string | null
  entry_tx_signature: string | null
  exit_tx_signature: string | null
  exit_price_usd: number | null
  profit_loss_sol: number | null
  profit_loss_percent: number | null
  // Limit buy fields
  target_entry_price: number | null
  entry_threshold_percent: number | null
  waiting_since: string | null
  max_wait_hours: number | null
  // Advanced trading features
  use_trailing_stop: boolean | null
  trailing_stop_percent: number | null
  highest_price_since_entry: number | null
  trailing_stop_price: number | null
  use_partial_profit: boolean | null
  partial_profit_percent: number | null
  partial_profit_price: number | null
  partial_profit_taken: boolean | null
  partial_profit_taken_at: string | null
  partial_tx_signature: string | null
  remaining_tokens: number | null
  use_breakeven_stop: boolean | null
  breakeven_trigger_percent: number | null
  breakeven_activated: boolean | null
  breakeven_activated_at: string | null
  max_hold_hours: number | null
  time_exit_triggered: boolean | null
  created_at: string
  updated_at: string
}

export interface PriceSnapshot {
  id: string
  token_mint: string
  price_usd: number
  price_sol: number | null
  volume_24h: number | null
  market_cap: number | null
  source: string
  created_at: string
}

export interface Trade {
  id: string
  user_id: string
  trading_plan_id: string | null
  token_mint: string
  token_symbol: string | null
  side: TradeSide
  amount_in: number
  amount_out: number
  input_mint: string
  output_mint: string
  price_usd: number
  tx_signature: string
  fee_sol: number | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      wallet_config: {
        Row: WalletConfig
        Insert: Omit<WalletConfig, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<WalletConfig, 'id' | 'user_id'>>
      }
      trading_plans: {
        Row: TradingPlan
        Insert: Omit<TradingPlan, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<TradingPlan, 'id' | 'user_id'>>
      }
      price_snapshots: {
        Row: PriceSnapshot
        Insert: Omit<PriceSnapshot, 'id' | 'created_at'>
        Update: Partial<Omit<PriceSnapshot, 'id'>>
      }
      trades: {
        Row: Trade
        Insert: Omit<Trade, 'id' | 'created_at'>
        Update: Partial<Omit<Trade, 'id' | 'user_id'>>
      }
    }
  }
}
