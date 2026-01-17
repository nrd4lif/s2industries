import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

/**
 * Encrypt a private key for storage
 * Uses the SUPABASE_SERVICE_ROLE_KEY as the encryption key
 */
export function encryptPrivateKey(privateKey: string): string {
  const encryptionKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!encryptionKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')
  }

  // Derive a 32-byte key from the service role key
  const key = crypto.scryptSync(encryptionKey, 's2-trading-salt', 32)

  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH)

  // Encrypt
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(privateKey, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  // Get auth tag
  const tag = cipher.getAuthTag()

  // Combine IV + Tag + Encrypted data
  const combined = Buffer.concat([iv, tag, Buffer.from(encrypted, 'base64')])

  return combined.toString('base64')
}

/**
 * Decrypt a stored private key
 */
export function decryptPrivateKey(encryptedData: string): string {
  const encryptionKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!encryptionKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')
  }

  // Derive the same 32-byte key
  const key = crypto.scryptSync(encryptionKey, 's2-trading-salt', 32)

  // Decode the combined data
  const combined = Buffer.from(encryptedData, 'base64')

  // Extract IV, Tag, and encrypted data
  const iv = combined.subarray(0, IV_LENGTH)
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH)

  // Decrypt
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(encrypted.toString('base64'), 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
