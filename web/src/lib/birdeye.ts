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

  // Suggested trading levels
  suggestedEntry: number
  suggestedStopLoss: number
  suggestedStopLossPercent: number
  suggestedTakeProfit: number
  suggestedTakeProfitPercent: number

  // Support/Resistance levels
  support: number
  resistance: number

  // Scalping suitability score (0-100)
  scalpingScore: number
  scalpingVerdict: 'good' | 'moderate' | 'poor'
  scalpingReason: string

  // Raw candle data for charting
  candles: OHLCVCandle[]
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
    const url = new URL(`${BIRDEYE_API_URL}/defi/v3/ohlcv`)
    url.searchParams.set('address', params.address)
    url.searchParams.set('type', params.interval)
    url.searchParams.set('time_from', params.timeFrom.toString())
    url.searchParams.set('time_to', params.timeTo.toString())

    const res = await fetch(url.toString(), { headers: this.headers })

    if (!res.ok) {
      throw new Error(`Birdeye OHLCV failed: ${res.status}`)
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
      scalpingScore -= 20  // Too stable, not enough movement
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
      scalpingReason = `Good volatility (${volatility.toFixed(1)}%), ${trend} trend, favorable risk/reward ratio of ${riskRewardRatio.toFixed(1)}:1`
    } else if (scalpingScore >= 40) {
      scalpingVerdict = 'moderate'
      scalpingReason = `Moderate conditions. Volatility: ${volatility.toFixed(1)}%, Trend: ${trend}, R/R: ${riskRewardRatio.toFixed(1)}:1`
    } else {
      scalpingVerdict = 'poor'
      if (volatility < 2) {
        scalpingReason = `Low volatility (${volatility.toFixed(1)}%) - not enough price movement for scalping`
      } else if (volatility > 20) {
        scalpingReason = `Very high volatility (${volatility.toFixed(1)}%) - high risk of sudden losses`
      } else if (avgVolume < 1000) {
        scalpingReason = `Low volume - may be difficult to exit position`
      } else {
        scalpingReason = `Unfavorable conditions for scalping. R/R: ${riskRewardRatio.toFixed(1)}:1`
      }
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
      suggestedEntry,
      suggestedStopLoss,
      suggestedStopLossPercent,
      suggestedTakeProfit,
      suggestedTakeProfitPercent,
      support,
      resistance,
      scalpingScore,
      scalpingVerdict,
      scalpingReason,
      candles,
    }
  }
}
