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
    // Try the token search API
    const url = `https://api.jup.ag/tokens/v1/token/${encodeURIComponent(query)}`
    const res = await fetch(url, { headers: this.headers })

    if (res.ok) {
      // Direct token lookup returns a single token
      const data = await res.json()
      if (data && data.address) {
        return [{
          mint: data.address,
          symbol: data.symbol,
          name: data.name,
          decimals: data.decimals,
          logoURI: data.logoURI,
        }]
      }
    }

    // Try search endpoint as fallback
    const searchUrl = `https://api.jup.ag/tokens/v1/search?query=${encodeURIComponent(query)}`
    const searchRes = await fetch(searchUrl, { headers: this.headers })

    if (!searchRes.ok) {
      // If both fail, try treating it as a mint address directly
      if (query.length >= 32 && query.length <= 44) {
        return [{
          mint: query,
          symbol: 'Unknown',
          name: 'Unknown Token',
          decimals: 9,
        }]
      }
      throw new Error(`Jupiter search failed: ${searchRes.status}`)
    }

    const data = await searchRes.json() as JupiterTokenInfo[]
    return data
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
   * Get current price of a token in USD (using SOL as intermediary)
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
    const solValueUsd = quote.inUsdValue
    const tokenValueUsd = quote.outUsdValue
    const tokensReceived = parseInt(quote.outAmount)

    // Price per token = USD value / tokens received
    // Note: outAmount is in smallest units, need to know decimals for accurate price
    const priceUsd = tokenValueUsd / tokensReceived  // This is per smallest unit
    const priceSol = 1 / tokensReceived  // SOL per smallest unit

    return {
      priceUsd: quote.inUsdValue,  // USD value of 1 SOL
      priceSol: 1 / tokensReceived,
    }
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
