const BIRDEYE_API_URL = 'https://public-api.birdeye.so'

interface OHLCVCandle {
  o: number  // open
  h: number  // high
  l: number  // low
  c: number  // close
  v: number  // volume
  unixTime: number
}

interface OHLCVResponse {
  success: boolean
  data: {
    items: OHLCVCandle[]
  }
}

// Technical indicator interfaces
export interface RSIData {
  value: number  // 0-100
  signal: 'overbought' | 'oversold' | 'neutral'
  divergence: 'bullish' | 'bearish' | 'none'  // Price vs RSI divergence
}

export interface EMAData {
  ema9: number
  ema21: number
  crossover: 'bullish' | 'bearish' | 'none'  // Recent crossover signal
  priceVsEma: 'above_both' | 'between' | 'below_both'
}

export interface BollingerBands {
  upper: number
  middle: number  // 20-period SMA
  lower: number
  bandwidth: number  // (upper - lower) / middle * 100
  percentB: number  // Where price is within bands (0 = lower, 1 = upper)
  signal: 'overbought' | 'oversold' | 'squeeze' | 'neutral'
}

export interface StochasticData {
  k: number  // %K line (0-100)
  d: number  // %D line (3-period SMA of %K)
  signal: 'overbought' | 'oversold' | 'neutral'
  crossover: 'bullish' | 'bearish' | 'none'  // %K crossing %D
}

export interface TechnicalIndicators {
  rsi: RSIData
  ema: EMAData
  bollingerBands: BollingerBands
  stochastic: StochasticData
  confluenceScore: number  // 0-100, how many indicators agree
  confluenceSignal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell'
}

export interface PriceAnalysis {
  currentPrice: number
  high24h: number
  low24h: number
  priceChange24h: number
  priceChangePercent24h: number
  volatility: number  // Standard deviation as % of mean
  trend: 'bullish' | 'bearish' | 'sideways'
  trendStrength: number  // 0-100
  avgVolume: number

  // Technical indicators
  indicators: TechnicalIndicators

  // Momentum indicators
  momentum: {
    score: number  // 0-100 momentum strength
    direction: 'up' | 'down' | 'neutral'
    consistency: number  // 0-100 how consistent the trend is (higher = steadier climb/fall)
    higherLows: number  // Count of higher lows in last 24h
    higherHighs: number  // Count of higher highs in last 24h
    isMomentumPlay: boolean  // True if this is a good momentum entry
    momentumSignal: 'strong_momentum' | 'building' | 'fading' | 'none'
    momentumReason: string
  }

  // Suggested trading levels
  suggestedEntry: number
  suggestedStopLoss: number
  suggestedStopLossPercent: number
  suggestedTakeProfit: number
  suggestedTakeProfitPercent: number

  // Support/Resistance levels
  support: number
  resistance: number

  // Optimal entry analysis
  optimalEntryPrice: number  // Best price to buy at based on analysis
  optimalEntryReason: string
  currentVsOptimalPercent: number  // How far current price is from optimal (negative = cheaper)
  entrySignal: 'strong_buy' | 'buy' | 'momentum_buy' | 'wait' | 'avoid'  // Buy signal based on current vs optimal
  entrySignalReason: string

  // Expected profit if entering at current price vs optimal
  expectedProfitAtCurrent: number  // Expected % profit if buying now
  expectedProfitAtOptimal: number  // Expected % profit if buying at optimal

  // Scalping suitability score (0-100)
  scalpingScore: number
  scalpingVerdict: 'good' | 'moderate' | 'poor'
  scalpingReason: string

  // Raw candle data for charting
  candles: OHLCVCandle[]
}

// ========================================
// TECHNICAL INDICATOR CALCULATIONS
// ========================================

/**
 * Calculate RSI (Relative Strength Index)
 * @param closes Array of closing prices
 * @param period RSI period (default 14)
 */
function calculateRSI(closes: number[], period: number = 14): RSIData {
  if (closes.length < period + 1) {
    return { value: 50, signal: 'neutral', divergence: 'none' }
  }

  // Calculate price changes
  const changes: number[] = []
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1])
  }

  // Calculate initial average gain/loss
  let avgGain = 0
  let avgLoss = 0
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i]
    else avgLoss += Math.abs(changes[i])
  }
  avgGain /= period
  avgLoss /= period

  // Calculate smoothed RSI using Wilder's smoothing
  for (let i = period; i < changes.length; i++) {
    const change = changes[i]
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period
      avgLoss = (avgLoss * (period - 1)) / period
    } else {
      avgGain = (avgGain * (period - 1)) / period
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period
    }
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
  const rsi = 100 - (100 / (1 + rs))

  // Determine signal
  let signal: 'overbought' | 'oversold' | 'neutral' = 'neutral'
  if (rsi >= 70) signal = 'overbought'
  else if (rsi <= 30) signal = 'oversold'

  // Check for divergence (price making new high but RSI not, or vice versa)
  let divergence: 'bullish' | 'bearish' | 'none' = 'none'
  if (closes.length >= period * 2) {
    const recentCloses = closes.slice(-period)
    const olderCloses = closes.slice(-period * 2, -period)
    const recentHigh = Math.max(...recentCloses)
    const olderHigh = Math.max(...olderCloses)

    // Calculate RSI for older period
    const olderRSI = calculateRSIValue(closes.slice(0, -period), period)

    // Bearish divergence: price higher high, RSI lower high
    if (recentHigh > olderHigh && rsi < olderRSI) {
      divergence = 'bearish'
    }
    // Bullish divergence: price lower low, RSI higher low
    const recentLow = Math.min(...recentCloses)
    const olderLow = Math.min(...olderCloses)
    if (recentLow < olderLow && rsi > olderRSI) {
      divergence = 'bullish'
    }
  }

  return { value: Math.round(rsi * 10) / 10, signal, divergence }
}

// Helper to calculate just RSI value
function calculateRSIValue(closes: number[], period: number): number {
  if (closes.length < period + 1) return 50

  const changes: number[] = []
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1])
  }

  let avgGain = 0
  let avgLoss = 0
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i]
    else avgLoss += Math.abs(changes[i])
  }
  avgGain /= period
  avgLoss /= period

  for (let i = period; i < changes.length; i++) {
    const change = changes[i]
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period
      avgLoss = (avgLoss * (period - 1)) / period
    } else {
      avgGain = (avgGain * (period - 1)) / period
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period
    }
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
  return 100 - (100 / (1 + rs))
}

/**
 * Calculate EMA (Exponential Moving Average)
 * @param closes Array of closing prices
 * @param period EMA period
 */
function calculateEMA(closes: number[], period: number): number[] {
  if (closes.length < period) return []

  const multiplier = 2 / (period + 1)
  const emaValues: number[] = []

  // Start with SMA for first EMA value
  let sma = 0
  for (let i = 0; i < period; i++) {
    sma += closes[i]
  }
  sma /= period
  emaValues.push(sma)

  // Calculate EMA for remaining values
  for (let i = period; i < closes.length; i++) {
    const ema = (closes[i] - emaValues[emaValues.length - 1]) * multiplier + emaValues[emaValues.length - 1]
    emaValues.push(ema)
  }

  return emaValues
}

/**
 * Calculate EMA crossover signals
 */
function calculateEMASignals(closes: number[]): EMAData {
  const ema9Values = calculateEMA(closes, 9)
  const ema21Values = calculateEMA(closes, 21)

  if (ema9Values.length < 2 || ema21Values.length < 2) {
    return {
      ema9: closes[closes.length - 1],
      ema21: closes[closes.length - 1],
      crossover: 'none',
      priceVsEma: 'between'
    }
  }

  const ema9 = ema9Values[ema9Values.length - 1]
  const ema21 = ema21Values[ema21Values.length - 1]
  const prevEma9 = ema9Values[ema9Values.length - 2]
  const prevEma21 = ema21Values[ema21Values.length - 2]
  const currentPrice = closes[closes.length - 1]

  // Check for crossover in last candle
  let crossover: 'bullish' | 'bearish' | 'none' = 'none'
  if (prevEma9 <= prevEma21 && ema9 > ema21) {
    crossover = 'bullish'  // 9 EMA crossed above 21 EMA
  } else if (prevEma9 >= prevEma21 && ema9 < ema21) {
    crossover = 'bearish'  // 9 EMA crossed below 21 EMA
  }

  // Check price position relative to EMAs
  let priceVsEma: 'above_both' | 'between' | 'below_both' = 'between'
  if (currentPrice > ema9 && currentPrice > ema21) {
    priceVsEma = 'above_both'
  } else if (currentPrice < ema9 && currentPrice < ema21) {
    priceVsEma = 'below_both'
  }

  return { ema9, ema21, crossover, priceVsEma }
}

/**
 * Calculate Bollinger Bands
 * @param closes Array of closing prices
 * @param period Period for middle band SMA (default 20)
 * @param stdDevMultiplier Standard deviation multiplier (default 2)
 */
function calculateBollingerBands(closes: number[], period: number = 20, stdDevMultiplier: number = 2): BollingerBands {
  if (closes.length < period) {
    const price = closes[closes.length - 1]
    return {
      upper: price,
      middle: price,
      lower: price,
      bandwidth: 0,
      percentB: 0.5,
      signal: 'neutral'
    }
  }

  // Calculate middle band (SMA)
  const recentCloses = closes.slice(-period)
  const middle = recentCloses.reduce((a, b) => a + b, 0) / period

  // Calculate standard deviation
  const squaredDiffs = recentCloses.map(c => Math.pow(c - middle, 2))
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period
  const stdDev = Math.sqrt(variance)

  // Calculate bands
  const upper = middle + (stdDev * stdDevMultiplier)
  const lower = middle - (stdDev * stdDevMultiplier)
  const bandwidth = ((upper - lower) / middle) * 100

  // Calculate %B (where price is within bands)
  const currentPrice = closes[closes.length - 1]
  const percentB = (currentPrice - lower) / (upper - lower)

  // Determine signal
  let signal: 'overbought' | 'oversold' | 'squeeze' | 'neutral' = 'neutral'
  if (percentB >= 1) {
    signal = 'overbought'  // Price at or above upper band
  } else if (percentB <= 0) {
    signal = 'oversold'  // Price at or below lower band
  } else if (bandwidth < 5) {
    signal = 'squeeze'  // Low volatility squeeze, potential breakout
  }

  return { upper, middle, lower, bandwidth, percentB, signal }
}

/**
 * Calculate Stochastic Oscillator
 * @param highs Array of high prices
 * @param lows Array of low prices
 * @param closes Array of closing prices
 * @param kPeriod %K period (default 5)
 * @param dPeriod %D period (default 3)
 */
function calculateStochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  kPeriod: number = 5,
  dPeriod: number = 3
): StochasticData {
  if (closes.length < kPeriod + dPeriod) {
    return { k: 50, d: 50, signal: 'neutral', crossover: 'none' }
  }

  // Calculate %K values
  const kValues: number[] = []
  for (let i = kPeriod - 1; i < closes.length; i++) {
    const periodHighs = highs.slice(i - kPeriod + 1, i + 1)
    const periodLows = lows.slice(i - kPeriod + 1, i + 1)
    const highestHigh = Math.max(...periodHighs)
    const lowestLow = Math.min(...periodLows)
    const k = highestHigh === lowestLow ? 50 : ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100
    kValues.push(k)
  }

  // Calculate %D (SMA of %K)
  const dValues: number[] = []
  for (let i = dPeriod - 1; i < kValues.length; i++) {
    const d = kValues.slice(i - dPeriod + 1, i + 1).reduce((a, b) => a + b, 0) / dPeriod
    dValues.push(d)
  }

  const k = kValues[kValues.length - 1]
  const d = dValues[dValues.length - 1]
  const prevK = kValues[kValues.length - 2] || k
  const prevD = dValues[dValues.length - 2] || d

  // Determine signal
  let signal: 'overbought' | 'oversold' | 'neutral' = 'neutral'
  if (k >= 80 && d >= 80) signal = 'overbought'
  else if (k <= 20 && d <= 20) signal = 'oversold'

  // Check for crossover
  let crossover: 'bullish' | 'bearish' | 'none' = 'none'
  if (prevK <= prevD && k > d) {
    crossover = 'bullish'  // %K crossed above %D
  } else if (prevK >= prevD && k < d) {
    crossover = 'bearish'  // %K crossed below %D
  }

  return {
    k: Math.round(k * 10) / 10,
    d: Math.round(d * 10) / 10,
    signal,
    crossover
  }
}

/**
 * Calculate confluence of all indicators
 */
function calculateConfluence(
  rsi: RSIData,
  ema: EMAData,
  bb: BollingerBands,
  stoch: StochasticData
): { score: number; signal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell' } {
  let bullishSignals = 0
  let bearishSignals = 0

  // RSI signals
  if (rsi.signal === 'oversold') bullishSignals += 2
  else if (rsi.signal === 'overbought') bearishSignals += 2
  if (rsi.divergence === 'bullish') bullishSignals += 1
  else if (rsi.divergence === 'bearish') bearishSignals += 1

  // EMA signals
  if (ema.crossover === 'bullish') bullishSignals += 2
  else if (ema.crossover === 'bearish') bearishSignals += 2
  if (ema.priceVsEma === 'above_both') bullishSignals += 1
  else if (ema.priceVsEma === 'below_both') bearishSignals += 1

  // Bollinger Bands signals
  if (bb.signal === 'oversold') bullishSignals += 2
  else if (bb.signal === 'overbought') bearishSignals += 2
  if (bb.percentB < 0.2) bullishSignals += 1
  else if (bb.percentB > 0.8) bearishSignals += 1

  // Stochastic signals
  if (stoch.signal === 'oversold') bullishSignals += 1
  else if (stoch.signal === 'overbought') bearishSignals += 1
  if (stoch.crossover === 'bullish') bullishSignals += 2
  else if (stoch.crossover === 'bearish') bearishSignals += 2

  const totalSignals = bullishSignals + bearishSignals
  const maxPossible = 16  // Maximum possible signals

  // Calculate score (0-100)
  let score = 50  // Neutral
  if (bullishSignals > bearishSignals) {
    score = 50 + ((bullishSignals - bearishSignals) / maxPossible) * 50
  } else if (bearishSignals > bullishSignals) {
    score = 50 - ((bearishSignals - bullishSignals) / maxPossible) * 50
  }
  score = Math.max(0, Math.min(100, Math.round(score)))

  // Determine signal
  let signal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell' = 'neutral'
  if (bullishSignals >= 6 && bearishSignals <= 1) signal = 'strong_buy'
  else if (bullishSignals >= 4 && bullishSignals > bearishSignals * 2) signal = 'buy'
  else if (bearishSignals >= 6 && bullishSignals <= 1) signal = 'strong_sell'
  else if (bearishSignals >= 4 && bearishSignals > bullishSignals * 2) signal = 'sell'

  return { score, signal }
}

export class BirdeyeClient {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private get headers() {
    return {
      'X-API-KEY': this.apiKey,
      'x-chain': 'solana',
    }
  }

  /**
   * Fetch OHLCV candles for a token
   */
  async getOHLCV(params: {
    address: string
    interval: string  // '15m', '1H', etc.
    timeFrom: number  // Unix timestamp
    timeTo: number
  }): Promise<OHLCVCandle[]> {
    const url = new URL(`${BIRDEYE_API_URL}/defi/ohlcv`)
    url.searchParams.set('address', params.address)
    url.searchParams.set('type', params.interval)
    url.searchParams.set('time_from', params.timeFrom.toString())
    url.searchParams.set('time_to', params.timeTo.toString())

    const res = await fetch(url.toString(), { headers: this.headers })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('Birdeye error response:', errorText)
      throw new Error(`Birdeye OHLCV failed: ${res.status} - ${errorText}`)
    }

    const data = await res.json() as OHLCVResponse

    if (!data.success || !data.data?.items) {
      throw new Error('Invalid Birdeye response')
    }

    return data.data.items
  }

  /**
   * Get 24h of 15-minute candles and analyze for scalping
   */
  async analyzeToken(address: string): Promise<PriceAnalysis> {
    const now = Math.floor(Date.now() / 1000)
    const oneDayAgo = now - (24 * 60 * 60)

    const candles = await this.getOHLCV({
      address,
      interval: '15m',
      timeFrom: oneDayAgo,
      timeTo: now,
    })

    if (candles.length < 10) {
      throw new Error('Insufficient price data (need at least 10 candles)')
    }

    // Sort by time ascending
    candles.sort((a, b) => a.unixTime - b.unixTime)

    // Basic stats
    const closes = candles.map(c => c.c)
    const highs = candles.map(c => c.h)
    const lows = candles.map(c => c.l)
    const volumes = candles.map(c => c.v)

    const currentPrice = closes[closes.length - 1]
    const openPrice = closes[0]
    const high24h = Math.max(...highs)
    const low24h = Math.min(...lows)
    const priceChange24h = currentPrice - openPrice
    const priceChangePercent24h = (priceChange24h / openPrice) * 100
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length

    // Calculate volatility (standard deviation as % of mean)
    const mean = closes.reduce((a, b) => a + b, 0) / closes.length
    const squaredDiffs = closes.map(c => Math.pow(c - mean, 2))
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / closes.length
    const stdDev = Math.sqrt(variance)
    const volatility = (stdDev / mean) * 100

    // Determine trend using simple moving averages
    const recentCandles = candles.slice(-8)  // Last 2 hours
    const olderCandles = candles.slice(-16, -8)  // 2-4 hours ago

    const recentAvg = recentCandles.reduce((a, c) => a + c.c, 0) / recentCandles.length
    const olderAvg = olderCandles.length > 0
      ? olderCandles.reduce((a, c) => a + c.c, 0) / olderCandles.length
      : recentAvg

    const trendDiff = ((recentAvg - olderAvg) / olderAvg) * 100
    let trend: 'bullish' | 'bearish' | 'sideways'
    let trendStrength: number

    if (trendDiff > 2) {
      trend = 'bullish'
      trendStrength = Math.min(100, trendDiff * 10)
    } else if (trendDiff < -2) {
      trend = 'bearish'
      trendStrength = Math.min(100, Math.abs(trendDiff) * 10)
    } else {
      trend = 'sideways'
      trendStrength = 100 - Math.abs(trendDiff) * 20
    }

    // ========================================
    // MOMENTUM ANALYSIS
    // ========================================

    // Find swing points (local highs and lows) using 3-candle window
    const swingHighs: { price: number; index: number }[] = []
    const swingLowsAll: { price: number; index: number }[] = []

    for (let i = 1; i < candles.length - 1; i++) {
      const prev = candles[i - 1]
      const curr = candles[i]
      const next = candles[i + 1]

      // Swing high: higher than both neighbors
      if (curr.h > prev.h && curr.h > next.h) {
        swingHighs.push({ price: curr.h, index: i })
      }
      // Swing low: lower than both neighbors
      if (curr.l < prev.l && curr.l < next.l) {
        swingLowsAll.push({ price: curr.l, index: i })
      }
    }

    // Count higher highs and higher lows (bullish structure)
    let higherHighs = 0
    let higherLows = 0
    let lowerHighs = 0
    let lowerLows = 0

    for (let i = 1; i < swingHighs.length; i++) {
      if (swingHighs[i].price > swingHighs[i - 1].price) {
        higherHighs++
      } else {
        lowerHighs++
      }
    }

    for (let i = 1; i < swingLowsAll.length; i++) {
      if (swingLowsAll[i].price > swingLowsAll[i - 1].price) {
        higherLows++
      } else {
        lowerLows++
      }
    }

    // Calculate momentum consistency (how steady is the trend)
    // High consistency = price moves in one direction with few reversals
    const totalSwings = swingHighs.length + swingLowsAll.length
    const bullishSwings = higherHighs + higherLows
    const bearishSwings = lowerHighs + lowerLows

    let momentumConsistency = 0
    if (totalSwings > 2) {
      // Consistency is how one-sided the swings are
      const dominantSwings = Math.max(bullishSwings, bearishSwings)
      momentumConsistency = Math.min(100, (dominantSwings / (totalSwings / 2)) * 50)
    }

    // Calculate momentum direction and score
    let momentumDirection: 'up' | 'down' | 'neutral' = 'neutral'
    let momentumScore = 0

    // Use 24h price change as base momentum indicator
    if (priceChangePercent24h > 5) {
      momentumDirection = 'up'
      momentumScore = Math.min(100, priceChangePercent24h * 2)
    } else if (priceChangePercent24h < -5) {
      momentumDirection = 'down'
      momentumScore = Math.min(100, Math.abs(priceChangePercent24h) * 2)
    }

    // Boost score for consistent structure
    if (momentumDirection === 'up' && higherLows >= 2 && higherHighs >= 1) {
      momentumScore = Math.min(100, momentumScore + 20)
    }
    if (momentumDirection === 'down' && lowerHighs >= 2 && lowerLows >= 1) {
      momentumScore = Math.min(100, momentumScore + 20)
    }

    // Factor in consistency
    momentumScore = Math.min(100, (momentumScore + momentumConsistency) / 2 + (momentumScore > 50 ? 20 : 0))

    // Determine momentum signal
    let momentumSignal: 'strong_momentum' | 'building' | 'fading' | 'none' = 'none'
    let momentumReason = ''
    let isMomentumPlay = false

    // Check for strong upward momentum (good for immediate buy)
    if (momentumDirection === 'up' && priceChangePercent24h >= 10 && higherLows >= 2) {
      momentumSignal = 'strong_momentum'
      momentumReason = `Strong uptrend: +${priceChangePercent24h.toFixed(1)}% with ${higherLows} higher lows - momentum entry viable`
      isMomentumPlay = true
    } else if (momentumDirection === 'up' && priceChangePercent24h >= 5 && momentumConsistency >= 50) {
      momentumSignal = 'building'
      momentumReason = `Building momentum: +${priceChangePercent24h.toFixed(1)}% with consistent upward structure`
      isMomentumPlay = volatility < 5  // Only momentum play if low volatility (steady climb)
    } else if (momentumDirection === 'up' && priceChangePercent24h >= 5 && momentumConsistency < 30) {
      momentumSignal = 'fading'
      momentumReason = `Momentum may be fading: +${priceChangePercent24h.toFixed(1)}% but inconsistent structure`
    } else if (momentumDirection === 'up') {
      momentumReason = `Mild upward movement: +${priceChangePercent24h.toFixed(1)}%`
    } else if (momentumDirection === 'down') {
      momentumReason = `Downward momentum: ${priceChangePercent24h.toFixed(1)}% - not ideal for entry`
    } else {
      momentumReason = `No clear momentum direction`
    }

    const momentum = {
      score: Math.round(momentumScore),
      direction: momentumDirection,
      consistency: Math.round(momentumConsistency),
      higherLows,
      higherHighs,
      isMomentumPlay,
      momentumSignal,
      momentumReason,
    }

    // Find support and resistance levels
    // Simple approach: look at recent lows and highs
    const recentLows = lows.slice(-16)
    const recentHighs = highs.slice(-16)
    const support = Math.min(...recentLows)
    const resistance = Math.max(...recentHighs)

    // Calculate suggested entry (current price for market entry)
    const suggestedEntry = currentPrice

    // Calculate stop loss and take profit based on volatility and support/resistance
    // Stop loss: below recent support or 2x volatility, whichever is tighter
    const volatilityBasedSL = currentPrice * (1 - (volatility * 2) / 100)
    const supportBasedSL = support * 0.98  // 2% below support
    const suggestedStopLoss = Math.max(volatilityBasedSL, supportBasedSL)
    const suggestedStopLossPercent = ((currentPrice - suggestedStopLoss) / currentPrice) * 100

    // Take profit: above recent resistance or 3x volatility
    const volatilityBasedTP = currentPrice * (1 + (volatility * 3) / 100)
    const resistanceBasedTP = resistance * 1.02  // 2% above resistance
    const suggestedTakeProfit = Math.min(volatilityBasedTP, resistanceBasedTP)
    const suggestedTakeProfitPercent = ((suggestedTakeProfit - currentPrice) / currentPrice) * 100

    // Calculate scalping suitability score
    let scalpingScore = 50  // Start neutral

    // Good volatility (2-10%) is ideal for scalping
    if (volatility >= 2 && volatility <= 10) {
      scalpingScore += 20
    } else if (volatility > 10 && volatility <= 20) {
      scalpingScore += 10  // High volatility, riskier
    } else if (volatility > 20) {
      scalpingScore -= 10  // Too volatile
    } else {
      // Low volatility - but check if it's a momentum play
      if (momentum.isMomentumPlay) {
        scalpingScore += 15  // Low volatility + momentum = steady climb, good!
      } else {
        scalpingScore -= 10  // Low volatility without momentum = stagnant
      }
    }

    // Good volume is important
    if (avgVolume > 10000) {
      scalpingScore += 15
    } else if (avgVolume > 1000) {
      scalpingScore += 5
    } else {
      scalpingScore -= 15  // Low volume, hard to exit
    }

    // Clear trend is helpful
    if (trendStrength > 50) {
      scalpingScore += 15
    }

    // Momentum bonus
    if (momentum.isMomentumPlay) {
      scalpingScore += 15
    } else if (momentum.momentumSignal === 'building') {
      scalpingScore += 10
    }

    // Good risk/reward ratio (TP > SL)
    const riskRewardRatio = suggestedTakeProfitPercent / suggestedStopLossPercent
    if (riskRewardRatio >= 2) {
      scalpingScore += 10
    } else if (riskRewardRatio >= 1.5) {
      scalpingScore += 5
    } else if (riskRewardRatio < 1) {
      scalpingScore -= 20
    }

    scalpingScore = Math.max(0, Math.min(100, scalpingScore))

    let scalpingVerdict: 'good' | 'moderate' | 'poor'
    let scalpingReason: string

    if (scalpingScore >= 70) {
      scalpingVerdict = 'good'
      if (momentum.isMomentumPlay) {
        scalpingReason = `Strong momentum play: +${priceChangePercent24h.toFixed(1)}% with consistent uptrend. ${trend} trend, R/R: ${riskRewardRatio.toFixed(1)}:1`
      } else {
        scalpingReason = `Good volatility (${volatility.toFixed(1)}%), ${trend} trend, favorable risk/reward ratio of ${riskRewardRatio.toFixed(1)}:1`
      }
    } else if (scalpingScore >= 40) {
      scalpingVerdict = 'moderate'
      scalpingReason = `Moderate conditions. Volatility: ${volatility.toFixed(1)}%, Trend: ${trend}, R/R: ${riskRewardRatio.toFixed(1)}:1`
    } else {
      scalpingVerdict = 'poor'
      if (volatility < 2 && !momentum.isMomentumPlay) {
        scalpingReason = `Low volatility (${volatility.toFixed(1)}%) without momentum - not enough price movement`
      } else if (volatility > 20) {
        scalpingReason = `Very high volatility (${volatility.toFixed(1)}%) - high risk of sudden losses`
      } else if (avgVolume < 1000) {
        scalpingReason = `Low volume - may be difficult to exit position`
      } else {
        scalpingReason = `Unfavorable conditions for scalping. R/R: ${riskRewardRatio.toFixed(1)}:1`
      }
    }

    // Calculate optimal entry point
    // Strategy: Look for price near support level with bullish momentum
    // The optimal entry is near support but with signs of reversal

    // Find recent swing lows (local minimums) as potential entry points
    const recentPrices = closes.slice(-16)  // Last 4 hours
    const swingLows: number[] = []
    for (let i = 1; i < recentPrices.length - 1; i++) {
      if (recentPrices[i] < recentPrices[i - 1] && recentPrices[i] < recentPrices[i + 1]) {
        swingLows.push(recentPrices[i])
      }
    }

    // Calculate VWAP (Volume Weighted Average Price) as a fair value indicator
    const totalVolumePrice = candles.reduce((sum, c) => sum + (c.c * c.v), 0)
    const totalVolume = candles.reduce((sum, c) => sum + c.v, 0)
    const vwap = totalVolume > 0 ? totalVolumePrice / totalVolume : mean

    // Calculate optimal entry based on multiple factors
    let optimalEntryPrice: number
    let optimalEntryReason: string

    if (trend === 'bullish') {
      // In uptrend: buy on pullbacks to VWAP or recent swing lows
      const recentSwingLow = swingLows.length > 0 ? Math.max(...swingLows) : support
      optimalEntryPrice = Math.max(recentSwingLow, vwap * 0.995)  // Slight discount to VWAP
      optimalEntryReason = `Bullish trend - optimal entry near VWAP ($${vwap.toPrecision(4)}) or recent pullback levels`
    } else if (trend === 'bearish') {
      // In downtrend: wait for support test or significant discount
      optimalEntryPrice = support * 1.01  // Just above support
      optimalEntryReason = `Bearish trend - wait for support level test at $${support.toPrecision(4)}`
    } else {
      // Sideways: buy near support
      optimalEntryPrice = support + (resistance - support) * 0.2  // Lower 20% of range
      optimalEntryReason = `Sideways market - buy near lower range at $${optimalEntryPrice.toPrecision(4)}`
    }

    // Calculate how far current price is from optimal
    const currentVsOptimalPercent = ((currentPrice - optimalEntryPrice) / optimalEntryPrice) * 100

    // Determine entry signal
    let entrySignal: 'strong_buy' | 'buy' | 'momentum_buy' | 'wait' | 'avoid'
    let entrySignalReason: string

    // Check if current price is within acceptable range of optimal
    const acceptableRangePercent = volatility * 0.5  // Half the volatility as acceptable buffer

    if (scalpingVerdict === 'poor') {
      entrySignal = 'avoid'
      entrySignalReason = `Poor scalping conditions - ${scalpingReason}`
    } else if (momentum.isMomentumPlay) {
      // Strong momentum - buy now to catch the wave
      entrySignal = 'momentum_buy'
      entrySignalReason = `Momentum entry: ${momentum.momentumReason}. Buy now to catch continued upside.`
    } else if (momentum.momentumSignal === 'building' && currentVsOptimalPercent <= acceptableRangePercent * 3) {
      // Building momentum and price isn't too extended
      entrySignal = 'buy'
      entrySignalReason = `Building momentum with reasonable entry. ${momentum.momentumReason}`
    } else if (currentVsOptimalPercent <= -acceptableRangePercent) {
      // Current price is significantly below optimal (good deal)
      entrySignal = 'strong_buy'
      entrySignalReason = `Price is ${Math.abs(currentVsOptimalPercent).toFixed(1)}% below optimal entry - excellent opportunity`
    } else if (currentVsOptimalPercent <= acceptableRangePercent) {
      // Current price is near optimal
      entrySignal = 'buy'
      entrySignalReason = `Price is within ${acceptableRangePercent.toFixed(1)}% of optimal entry`
    } else if (currentVsOptimalPercent <= acceptableRangePercent * 2) {
      // Price is somewhat above optimal but still reasonable
      entrySignal = 'wait'
      entrySignalReason = `Price is ${currentVsOptimalPercent.toFixed(1)}% above optimal - consider waiting for pullback`
    } else {
      // Price is too far above optimal
      entrySignal = 'wait'
      entrySignalReason = `Price is ${currentVsOptimalPercent.toFixed(1)}% above optimal - wait for better entry`
    }

    // Calculate expected profits
    const expectedProfitAtCurrent = ((suggestedTakeProfit - currentPrice) / currentPrice) * 100
    const expectedProfitAtOptimal = ((suggestedTakeProfit - optimalEntryPrice) / optimalEntryPrice) * 100

    // ========================================
    // TECHNICAL INDICATORS
    // ========================================

    // Calculate all technical indicators from candle data
    const rsi = calculateRSI(closes, 14)
    const ema = calculateEMASignals(closes)
    const bollingerBands = calculateBollingerBands(closes, 20, 2)
    const stochastic = calculateStochastic(highs, lows, closes, 5, 3)

    // Calculate confluence score
    const confluence = calculateConfluence(rsi, ema, bollingerBands, stochastic)

    const indicators: TechnicalIndicators = {
      rsi,
      ema,
      bollingerBands,
      stochastic,
      confluenceScore: confluence.score,
      confluenceSignal: confluence.signal,
    }

    return {
      currentPrice,
      high24h,
      low24h,
      priceChange24h,
      priceChangePercent24h,
      volatility,
      trend,
      trendStrength,
      avgVolume,
      indicators,
      momentum,
      suggestedEntry,
      suggestedStopLoss,
      suggestedStopLossPercent,
      suggestedTakeProfit,
      suggestedTakeProfitPercent,
      support,
      resistance,
      optimalEntryPrice,
      optimalEntryReason,
      currentVsOptimalPercent,
      entrySignal,
      entrySignalReason,
      expectedProfitAtCurrent,
      expectedProfitAtOptimal,
      scalpingScore,
      scalpingVerdict,
      scalpingReason,
      candles,
    }
  }
}
