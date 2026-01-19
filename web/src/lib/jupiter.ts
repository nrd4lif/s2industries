import { Keypair, VersionedTransaction } from '@solana/web3.js'
import bs58 from 'bs58'

const JUPITER_API_URL = 'https://api.jup.ag/ultra/v1'
const SOL_MINT = 'So11111111111111111111111111111111111111112'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

// Lamports per SOL
const LAMPORTS_PER_SOL = 1_000_000_000

interface JupiterOrderResponse {
  mode: string
  inputMint: string
  outputMint: string
  inAmount: string
  outAmount: string
  slippageBps: number
  priceImpact: number
  routePlan: unknown[]
  feeBps: number
  platformFee: { feeBps: number; amount: string }
  signatureFeeLamports: number
  prioritizationFeeLamports: number
  rentFeeLamports: number
  router: string
  transaction: string | null
  gasless: boolean
  requestId: string
  totalTime: number
  taker: string | null
  inUsdValue: number
  outUsdValue: number
  quoteId: string
  expireAt: string
}

interface JupiterExecuteResponse {
  status: 'Success' | 'Failed'
  code: number
  signature: string
  slot: string
  error?: string
  totalInputAmount: string
  totalOutputAmount: string
  inputAmountResult: string
  outputAmountResult: string
  swapEvents: Array<{
    inputMint: string
    inputAmount: string
    outputMint: string
    outputAmount: string
  }>
}

interface JupiterTokenInfo {
  mint: string
  symbol: string
  name: string
  decimals: number
  logoURI?: string
}

interface JupiterSearchResponse {
  tokens: JupiterTokenInfo[]
}

// Trending token response from Jupiter Tokens API v2
export interface TrendingToken {
  id: string
  name: string
  symbol: string
  icon: string
  decimals: number
  twitter?: string
  telegram?: string
  website?: string
  circSupply: number
  totalSupply: number
  fdv: number
  mcap: number
  usdPrice: number
  liquidity: number
  stats5m: TokenStats
  stats1h: TokenStats
  stats6h: TokenStats
  stats24h: TokenStats
  firstPool?: {
    createdAt: string
    poolAddress: string
  }
  isSus: boolean
  mintAuthority: boolean
  freezeAuthority: boolean
  topHolderPercentage: number
  isVerified: boolean
}

interface TokenStats {
  priceChange: number  // Percentage
  holderChange: number
  liquidityChange: number
  volume: number
  buyVolume: number
  sellVolume: number
  numBuys: number
  numSells: number
}

export type TrendingCategory = 'toptrending' | 'toptraded' | 'toporganicscore'
export type TrendingInterval = '5m' | '1h' | '6h' | '24h'

export class JupiterClient {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private get headers() {
    return {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
    }
  }

  /**
   * Search for tokens by symbol, name, or mint address
   */
  async searchToken(query: string): Promise<JupiterTokenInfo[]> {
    // Try the token search API first (direct lookup by mint address)
    const url = `https://api.jup.ag/tokens/v1/token/${encodeURIComponent(query)}`
    const res = await fetch(url, { headers: this.headers })

    if (res.ok) {
      // Direct token lookup returns a single token
      const data = await res.json()
      if (data && data.address) {
        return [{
          mint: data.address,
          symbol: data.symbol || 'Unknown',
          name: data.name || 'Unknown Token',
          decimals: data.decimals || 9,
          logoURI: data.logoURI,
        }]
      }
    }

    // Try search endpoint as fallback
    const searchUrl = `https://api.jup.ag/tokens/v1/search?query=${encodeURIComponent(query)}`
    const searchRes = await fetch(searchUrl, { headers: this.headers })

    if (searchRes.ok) {
      const searchData = await searchRes.json()
      // Search returns an array directly
      if (Array.isArray(searchData) && searchData.length > 0) {
        return searchData.map((t: { address?: string; mint?: string; symbol?: string; name?: string; decimals?: number; logoURI?: string }) => ({
          mint: t.address || t.mint || query,
          symbol: t.symbol || 'Unknown',
          name: t.name || 'Unknown Token',
          decimals: t.decimals || 9,
          logoURI: t.logoURI,
        }))
      }
    }

    // Try the strict token list as another fallback (for verified tokens)
    const strictUrl = `https://tokens.jup.ag/token/${query}`
    const strictRes = await fetch(strictUrl)

    if (strictRes.ok) {
      const strictData = await strictRes.json()
      if (strictData && (strictData.address || strictData.mint)) {
        return [{
          mint: strictData.address || strictData.mint,
          symbol: strictData.symbol || 'Unknown',
          name: strictData.name || 'Unknown Token',
          decimals: strictData.decimals || 9,
          logoURI: strictData.logoURI,
        }]
      }
    }

    // Try DexScreener as fallback for newer tokens
    if (query.length >= 32 && query.length <= 44) {
      try {
        const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${query}`)
        if (dexRes.ok) {
          const dexData = await dexRes.json()
          if (dexData.pairs && dexData.pairs.length > 0) {
            // Find the Solana pair
            const solanaPair = dexData.pairs.find((p: { chainId: string }) => p.chainId === 'solana')
            if (solanaPair && solanaPair.baseToken) {
              return [{
                mint: solanaPair.baseToken.address || query,
                symbol: solanaPair.baseToken.symbol || 'Unknown',
                name: solanaPair.baseToken.name || 'Unknown Token',
                decimals: 9, // DexScreener doesn't always provide decimals
                logoURI: undefined,
              }]
            }
          }
        }
      } catch (dexErr) {
        console.warn('DexScreener fallback failed:', dexErr)
      }
    }

    // Final fallback: if it looks like a mint address, return with Unknown
    if (query.length >= 32 && query.length <= 44) {
      console.warn(`Token ${query} not found in any source, using as-is`)
      return [{
        mint: query,
        symbol: 'Unknown',
        name: 'Unknown Token',
        decimals: 9,
      }]
    }

    throw new Error(`Token not found: ${query}`)
  }

  /**
   * Get a swap quote (SOL -> Token)
   */
  async getQuote(params: {
    outputMint: string
    amountSol: number
    taker: string
  }): Promise<JupiterOrderResponse> {
    const amountLamports = Math.floor(params.amountSol * LAMPORTS_PER_SOL)

    const url = new URL(`${JUPITER_API_URL}/order`)
    url.searchParams.set('inputMint', SOL_MINT)
    url.searchParams.set('outputMint', params.outputMint)
    url.searchParams.set('amount', amountLamports.toString())
    url.searchParams.set('taker', params.taker)

    const res = await fetch(url.toString(), { headers: this.headers })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(`Jupiter quote failed: ${error.errorMessage || res.status}`)
    }

    return res.json()
  }

  /**
   * Get a sell quote (Token -> SOL)
   */
  async getSellQuote(params: {
    inputMint: string
    amountTokens: string  // In smallest units (with decimals)
    taker: string
  }): Promise<JupiterOrderResponse> {
    const url = new URL(`${JUPITER_API_URL}/order`)
    url.searchParams.set('inputMint', params.inputMint)
    url.searchParams.set('outputMint', SOL_MINT)
    url.searchParams.set('amount', params.amountTokens)
    url.searchParams.set('taker', params.taker)

    const res = await fetch(url.toString(), { headers: this.headers })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(`Jupiter sell quote failed: ${error.errorMessage || res.status}`)
    }

    return res.json()
  }

  /**
   * Execute a signed swap transaction
   */
  async executeSwap(params: {
    signedTransaction: string
    requestId: string
  }): Promise<JupiterExecuteResponse> {
    const res = await fetch(`${JUPITER_API_URL}/execute`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        signedTransaction: params.signedTransaction,
        requestId: params.requestId,
      }),
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(`Jupiter execute failed: ${error.errorMessage || res.status}`)
    }

    return res.json()
  }

  /**
   * Sign and execute a swap in one step
   */
  async signAndExecute(params: {
    orderResponse: JupiterOrderResponse
    privateKey: string  // Base58 encoded private key
  }): Promise<JupiterExecuteResponse> {
    if (!params.orderResponse.transaction) {
      throw new Error('No transaction in order response')
    }

    // Decode the private key
    const keypair = Keypair.fromSecretKey(bs58.decode(params.privateKey))

    // Decode the transaction
    const txBuffer = Buffer.from(params.orderResponse.transaction, 'base64')
    const transaction = VersionedTransaction.deserialize(txBuffer)

    // Sign the transaction
    transaction.sign([keypair])

    // Serialize the signed transaction
    const signedTx = Buffer.from(transaction.serialize()).toString('base64')

    // Execute
    return this.executeSwap({
      signedTransaction: signedTx,
      requestId: params.orderResponse.requestId,
    })
  }

  /**
   * Get current market price of a token in USD using Jupiter Price API v3
   * Returns the actual token price (not per smallest unit)
   */
  async getTokenPrice(tokenMint: string): Promise<number> {
    const url = `https://api.jup.ag/price/v3?ids=${tokenMint}`
    const res = await fetch(url, { headers: this.headers })

    if (!res.ok) {
      throw new Error(`Jupiter price API failed: ${res.status}`)
    }

    const data = await res.json()
    // v3 response format: { "mint": { "usdPrice": number, ... } }
    const tokenData = data[tokenMint]

    if (!tokenData?.usdPrice) {
      throw new Error(`No price data for token ${tokenMint}`)
    }

    return tokenData.usdPrice
  }

  /**
   * Get current price of a token in USD (using quote - returns price per smallest unit)
   * @deprecated Use getTokenPrice for human-readable prices
   */
  async getPrice(tokenMint: string, taker: string): Promise<{
    priceUsd: number
    priceSol: number
  }> {
    // Get quote for 1 SOL worth of the token
    const quote = await this.getQuote({
      outputMint: tokenMint,
      amountSol: 1,
      taker,
    })

    // Calculate price from the quote
    const tokensReceived = parseInt(quote.outAmount)

    return {
      priceUsd: quote.inUsdValue,  // USD value of 1 SOL
      priceSol: 1 / tokensReceived,
    }
  }

  /**
   * Get trending/top tokens from Jupiter
   * Categories: toptrending, toptraded, toporganicscore
   * Intervals: 5m, 1h, 6h, 24h
   */
  async getTrendingTokens(params: {
    category: TrendingCategory
    interval: TrendingInterval
    limit?: number
  }): Promise<TrendingToken[]> {
    const url = new URL(`https://api.jup.ag/tokens/v2/${params.category}/${params.interval}`)
    if (params.limit) {
      url.searchParams.set('limit', params.limit.toString())
    }

    const res = await fetch(url.toString(), { headers: this.headers })

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`Jupiter trending failed: ${res.status} - ${errorText}`)
    }

    return res.json()
  }
}

/**
 * Generate a new Solana keypair for trading
 */
export function generateTradingWallet(): {
  publicKey: string
  privateKey: string
} {
  const keypair = Keypair.generate()
  return {
    publicKey: keypair.publicKey.toBase58(),
    privateKey: bs58.encode(keypair.secretKey),
  }
}

/**
 * Get public key from private key
 */
export function getPublicKeyFromPrivate(privateKey: string): string {
  const keypair = Keypair.fromSecretKey(bs58.decode(privateKey))
  return keypair.publicKey.toBase58()
}

export { SOL_MINT, USDC_MINT, LAMPORTS_PER_SOL }
export type { JupiterOrderResponse, JupiterExecuteResponse, JupiterTokenInfo }
