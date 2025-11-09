import crypto from 'crypto'

const ENC_KEY = process.env.TOKEN_ENCRYPTION_KEY!

function encrypt(text: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENC_KEY, ENC_KEY.length === 64 ? 'hex' : 'base64'), iv)
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

function decrypt(payload: string) {
  const buf = Buffer.from(payload, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENC_KEY, ENC_KEY.length === 64 ? 'hex' : 'base64'), iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(data), decipher.final()])
  return dec.toString('utf8')
}

export type CanvasToken = { access_token: string; refresh_token?: string; expires_in?: number; obtained_at: number }
export { encrypt, decrypt }

