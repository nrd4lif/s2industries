import { Resend } from 'resend'

// Lazy-load Resend client to avoid build-time errors
let resendClient: Resend | null = null

function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set')
    }
    resendClient = new Resend(apiKey)
  }
  return resendClient
}

// Default from address - you'll need to verify a domain in Resend
// or use onboarding@resend.dev for testing
function getFromEmail(): string {
  return process.env.EMAIL_FROM || 'S2 Trading <onboarding@resend.dev>'
}

export interface TradeExecutedEmailParams {
  to: string
  tokenSymbol: string
  tokenMint: string
  triggeredBy: 'stop_loss' | 'take_profit'
  entryPriceSol: number
  exitPriceSol: number
  amountSol: number
  profitLossSol: number
  profitLossPercent: number
  txSignature: string
}

export async function sendTradeExecutedEmail(params: TradeExecutedEmailParams) {
  const {
    to,
    tokenSymbol,
    tokenMint,
    triggeredBy,
    entryPriceSol,
    exitPriceSol,
    amountSol,
    profitLossSol,
    profitLossPercent,
    txSignature,
  } = params

  const isProfit = profitLossSol >= 0
  const triggerLabel = triggeredBy === 'take_profit' ? 'Take Profit' : 'Stop Loss'
  const profitLabel = isProfit ? 'Profit' : 'Loss'
  const profitColor = isProfit ? '#22c55e' : '#ef4444'
  const solscanUrl = `https://solscan.io/tx/${txSignature}`

  const subject = `${isProfit ? '✅' : '🔴'} Trade Executed: ${tokenSymbol} ${triggerLabel} (${isProfit ? '+' : ''}${profitLossPercent.toFixed(2)}%)`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Trade Executed</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #09090b; color: #fafafa; padding: 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #18181b; border-radius: 12px; border: 1px solid #27272a; overflow: hidden;">
          <!-- Header -->
          <div style="padding: 24px; border-bottom: 1px solid #27272a;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 600;">
              Trade Executed
            </h1>
            <p style="margin: 8px 0 0; color: #a1a1aa; font-size: 14px;">
              ${triggerLabel} triggered for ${tokenSymbol}
            </p>
          </div>

          <!-- Result Banner -->
          <div style="padding: 20px 24px; background-color: ${isProfit ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; border-bottom: 1px solid #27272a;">
            <div style="text-align: center;">
              <p style="margin: 0; font-size: 32px; font-weight: 700; color: ${profitColor};">
                ${isProfit ? '+' : ''}${profitLossPercent.toFixed(2)}%
              </p>
              <p style="margin: 8px 0 0; color: ${profitColor}; font-size: 14px;">
                ${profitLabel}: ${isProfit ? '+' : ''}${profitLossSol.toFixed(6)} SOL
              </p>
            </div>
          </div>

          <!-- Trade Details -->
          <div style="padding: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0; color: #71717a;">Token</td>
                <td style="padding: 8px 0; text-align: right; color: #fafafa; font-weight: 500;">${tokenSymbol}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #71717a;">Trigger</td>
                <td style="padding: 8px 0; text-align: right; color: ${triggeredBy === 'take_profit' ? '#22c55e' : '#ef4444'}; font-weight: 500;">${triggerLabel}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #71717a;">Position Size</td>
                <td style="padding: 8px 0; text-align: right; color: #fafafa;">${amountSol.toFixed(4)} SOL</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #71717a;">Entry Price</td>
                <td style="padding: 8px 0; text-align: right; color: #fafafa;">${entryPriceSol.toFixed(6)} SOL</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #71717a;">Exit Price</td>
                <td style="padding: 8px 0; text-align: right; color: #fafafa;">${exitPriceSol.toFixed(6)} SOL</td>
              </tr>
            </table>

            <!-- Transaction Link -->
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #27272a;">
              <a href="${solscanUrl}" target="_blank" style="display: block; text-align: center; padding: 12px 16px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">
                View Transaction on Solscan
              </a>
            </div>

            <!-- Token Mint -->
            <p style="margin: 16px 0 0; font-size: 12px; color: #52525b; word-break: break-all;">
              Token: ${tokenMint}
            </p>
          </div>

          <!-- Footer -->
          <div style="padding: 16px 24px; border-top: 1px solid #27272a; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #52525b;">
              S2 Trading Bot
            </p>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
Trade Executed: ${tokenSymbol} ${triggerLabel}

${profitLabel}: ${isProfit ? '+' : ''}${profitLossPercent.toFixed(2)}% (${isProfit ? '+' : ''}${profitLossSol.toFixed(6)} SOL)

Details:
- Token: ${tokenSymbol}
- Trigger: ${triggerLabel}
- Position Size: ${amountSol.toFixed(4)} SOL
- Entry Price: ${entryPriceSol.toFixed(6)} SOL
- Exit Price: ${exitPriceSol.toFixed(6)} SOL

View Transaction: ${solscanUrl}

Token Mint: ${tokenMint}
  `.trim()

  try {
    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to,
      subject,
      html,
      text,
    })

    if (error) {
      console.error('Failed to send trade email:', error)
      return { success: false, error }
    }

    console.log('Trade email sent:', data?.id)
    return { success: true, id: data?.id }
  } catch (err) {
    console.error('Email send error:', err)
    return { success: false, error: err }
  }
}

export interface TradeEntryEmailParams {
  to: string
  tokenSymbol: string
  tokenMint: string
  amountSol: number
  tokensReceived: number
  entryPriceUsd: number
  stopLossPercent: number
  takeProfitPercent: number
  stopLossPrice: number
  takeProfitPrice: number
  txSignature: string
  isLimitOrder?: boolean
}

export async function sendTradeEntryEmail(params: TradeEntryEmailParams) {
  const {
    to,
    tokenSymbol,
    tokenMint,
    amountSol,
    tokensReceived,
    entryPriceUsd,
    stopLossPercent,
    takeProfitPercent,
    stopLossPrice,
    takeProfitPrice,
    txSignature,
    isLimitOrder = false,
  } = params

  const solscanUrl = `https://solscan.io/tx/${txSignature}`
  const orderType = isLimitOrder ? 'Limit Order' : 'Market Order'

  // Format token amount
  const formattedTokens = tokensReceived >= 1_000_000_000
    ? `${(tokensReceived / 1_000_000_000).toFixed(2)}B`
    : tokensReceived >= 1_000_000
    ? `${(tokensReceived / 1_000_000).toFixed(2)}M`
    : tokensReceived >= 1_000
    ? `${(tokensReceived / 1_000).toFixed(2)}K`
    : tokensReceived.toFixed(2)

  // Format price
  const formatPrice = (price: number) => {
    if (price < 0.00000001) return price.toExponential(4)
    if (price < 0.0001) return price.toFixed(12)
    if (price < 1) return price.toFixed(8)
    return price.toFixed(4)
  }

  const subject = `🟢 Trade Entry: ${tokenSymbol} (${orderType})`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Trade Entry</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #09090b; color: #fafafa; padding: 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #18181b; border-radius: 12px; border: 1px solid #27272a; overflow: hidden;">
          <!-- Header -->
          <div style="padding: 24px; border-bottom: 1px solid #27272a;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 600;">
              Trade Entry Executed
            </h1>
            <p style="margin: 8px 0 0; color: #a1a1aa; font-size: 14px;">
              ${orderType} filled for ${tokenSymbol}
            </p>
          </div>

          <!-- Entry Banner -->
          <div style="padding: 20px 24px; background-color: rgba(34, 197, 94, 0.1); border-bottom: 1px solid #27272a;">
            <div style="text-align: center;">
              <p style="margin: 0; font-size: 24px; font-weight: 700; color: #22c55e;">
                ${formattedTokens} ${tokenSymbol}
              </p>
              <p style="margin: 8px 0 0; color: #a1a1aa; font-size: 14px;">
                @ $${formatPrice(entryPriceUsd)}
              </p>
            </div>
          </div>

          <!-- Trade Details -->
          <div style="padding: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0; color: #71717a;">Token</td>
                <td style="padding: 8px 0; text-align: right; color: #fafafa; font-weight: 500;">${tokenSymbol}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #71717a;">Order Type</td>
                <td style="padding: 8px 0; text-align: right; color: ${isLimitOrder ? '#a855f7' : '#3b82f6'}; font-weight: 500;">${orderType}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #71717a;">Investment</td>
                <td style="padding: 8px 0; text-align: right; color: #fafafa;">${amountSol} SOL</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #71717a;">Entry Price</td>
                <td style="padding: 8px 0; text-align: right; color: #fafafa;">$${formatPrice(entryPriceUsd)}</td>
              </tr>
              <tr style="border-top: 1px solid #27272a;">
                <td style="padding: 12px 0 8px; color: #71717a;">Stop Loss (-${stopLossPercent}%)</td>
                <td style="padding: 12px 0 8px; text-align: right; color: #ef4444;">$${formatPrice(stopLossPrice)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #71717a;">Take Profit (+${takeProfitPercent}%)</td>
                <td style="padding: 8px 0; text-align: right; color: #22c55e;">$${formatPrice(takeProfitPrice)}</td>
              </tr>
            </table>

            <!-- Transaction Link -->
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #27272a;">
              <a href="${solscanUrl}" target="_blank" style="display: block; text-align: center; padding: 12px 16px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">
                View Transaction on Solscan
              </a>
            </div>

            <!-- Token Mint -->
            <p style="margin: 16px 0 0; font-size: 12px; color: #52525b; word-break: break-all;">
              Token: ${tokenMint}
            </p>
          </div>

          <!-- Footer -->
          <div style="padding: 16px 24px; border-top: 1px solid #27272a; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #52525b;">
              S2 Trading Bot - Position now monitored for exit triggers
            </p>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
Trade Entry Executed: ${tokenSymbol} (${orderType})

Position: ${formattedTokens} ${tokenSymbol} @ $${formatPrice(entryPriceUsd)}

Details:
- Investment: ${amountSol} SOL
- Entry Price: $${formatPrice(entryPriceUsd)}
- Stop Loss (-${stopLossPercent}%): $${formatPrice(stopLossPrice)}
- Take Profit (+${takeProfitPercent}%): $${formatPrice(takeProfitPrice)}

View Transaction: ${solscanUrl}

Token Mint: ${tokenMint}

Position is now being monitored for exit triggers.
  `.trim()

  try {
    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to,
      subject,
      html,
      text,
    })

    if (error) {
      console.error('Failed to send entry email:', error)
      return { success: false, error }
    }

    console.log('Entry email sent:', data?.id)
    return { success: true, id: data?.id }
  } catch (err) {
    console.error('Email send error:', err)
    return { success: false, error: err }
  }
}

export interface TrendingOpportunityEmailParams {
  to: string
  opportunities: Array<{
    symbol: string
    mint: string
    scalpingScore: number
    entrySignal: string
    currentPrice: number
    expectedProfit: number
    trend: string
  }>
}

export async function sendTrendingOpportunitiesEmail(params: TrendingOpportunityEmailParams) {
  const { to, opportunities } = params

  if (opportunities.length === 0) {
    return { success: true, skipped: true }
  }

  const subject = `📈 ${opportunities.length} Scalping Opportunit${opportunities.length === 1 ? 'y' : 'ies'} Found`

  const opportunityRows = opportunities.map(opp => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #27272a;">
        <strong style="color: #fafafa;">${opp.symbol}</strong>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #27272a; text-align: center;">
        <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; ${
          opp.entrySignal === 'strong_buy' ? 'background-color: rgba(34, 197, 94, 0.2); color: #22c55e;' :
          opp.entrySignal === 'buy' ? 'background-color: rgba(34, 197, 94, 0.1); color: #4ade80;' :
          'background-color: rgba(234, 179, 8, 0.1); color: #eab308;'
        }">
          ${opp.entrySignal.replace('_', ' ').toUpperCase()}
        </span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #27272a; text-align: center; color: #fafafa;">
        ${opp.scalpingScore}/100
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #27272a; text-align: right; color: #22c55e;">
        +${opp.expectedProfit.toFixed(1)}%
      </td>
    </tr>
  `).join('')

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #09090b; color: #fafafa; padding: 20px; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #18181b; border-radius: 12px; border: 1px solid #27272a; overflow: hidden;">
          <div style="padding: 24px; border-bottom: 1px solid #27272a;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 600;">
              Scalping Opportunities
            </h1>
            <p style="margin: 8px 0 0; color: #a1a1aa; font-size: 14px;">
              ${opportunities.length} token${opportunities.length === 1 ? '' : 's'} with good entry signals
            </p>
          </div>

          <div style="padding: 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <thead>
                <tr style="background-color: #27272a;">
                  <th style="padding: 12px; text-align: left; color: #a1a1aa; font-weight: 500;">Token</th>
                  <th style="padding: 12px; text-align: center; color: #a1a1aa; font-weight: 500;">Signal</th>
                  <th style="padding: 12px; text-align: center; color: #a1a1aa; font-weight: 500;">Score</th>
                  <th style="padding: 12px; text-align: right; color: #a1a1aa; font-weight: 500;">Expected</th>
                </tr>
              </thead>
              <tbody>
                ${opportunityRows}
              </tbody>
            </table>
          </div>

          <div style="padding: 24px;">
            <a href="${process.env.NEXT_PUBLIC_SITE_URL}/trading/trending" target="_blank" style="display: block; text-align: center; padding: 12px 16px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">
              View in Dashboard
            </a>
          </div>

          <div style="padding: 16px 24px; border-top: 1px solid #27272a; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #52525b;">
              S2 Trading Bot
            </p>
          </div>
        </div>
      </body>
    </html>
  `

  const text = opportunities.map(opp =>
    `${opp.symbol}: ${opp.entrySignal.replace('_', ' ')} | Score: ${opp.scalpingScore}/100 | Expected: +${opp.expectedProfit.toFixed(1)}%`
  ).join('\n')

  try {
    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to,
      subject,
      html,
      text: `Scalping Opportunities Found:\n\n${text}\n\nView in dashboard: ${process.env.NEXT_PUBLIC_SITE_URL}/trading/trending`,
    })

    if (error) {
      console.error('Failed to send opportunities email:', error)
      return { success: false, error }
    }

    return { success: true, id: data?.id }
  } catch (err) {
    console.error('Email send error:', err)
    return { success: false, error: err }
  }
}
