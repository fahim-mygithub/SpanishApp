// Generates a VAPID key pair for push reminders. Run: npm run vapid
// Public key  -> VITE_VAPID_PUBLIC_KEY in .env.local, and `npx wrangler secret put VAPID_PUBLIC_KEY` in worker/
// Private key -> `npx wrangler secret put VAPID_PRIVATE_KEY` in worker/ (never commit it)
const { webcrypto: crypto } = await import('node:crypto')
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const raw = Buffer.from(await crypto.subtle.exportKey('raw', kp.publicKey)).toString('base64url')
const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey)
console.log(`VAPID_PUBLIC_KEY=${raw}`)
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`)
