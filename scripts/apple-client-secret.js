/**
 * Generate an Apple Sign In client secret (JWT) from your .p8 key.
 * Run: node scripts/apple-client-secret.js
 *
 * Set these env vars (or create a .env.apple file and load it - do NOT commit that file):
 *   APPLE_TEAM_ID      - from Apple Developer (Membership)
 *   APPLE_KEY_ID       - from your Sign in with Apple key
 *   APPLE_CLIENT_ID    - your Services ID (e.g. com.hrglss.app.web)
 *   APPLE_P8_PATH      - path to your .p8 file (e.g. ./AuthKey_XXXXX.p8)
 *
 * Output: the JWT to paste into Supabase → Apple provider → Secret Key (for OAuth).
 * The JWT expires in 6 months; re-run this script and update Supabase when it does.
 */

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const teamId = process.env.APPLE_TEAM_ID;
const keyId = process.env.APPLE_KEY_ID;
const clientId = process.env.APPLE_CLIENT_ID;
const p8Path = process.env.APPLE_P8_PATH;

if (!teamId || !keyId || !clientId || !p8Path) {
  console.error('Missing env vars. Set: APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_CLIENT_ID, APPLE_P8_PATH');
  process.exit(1);
}

const keyPath = path.resolve(process.cwd(), p8Path);
if (!fs.existsSync(keyPath)) {
  console.error('P8 file not found at:', keyPath);
  process.exit(1);
}

const privateKey = fs.readFileSync(keyPath, 'utf8');

const token = jwt.sign(
  {},
  privateKey,
  {
    algorithm: 'ES256',
    expiresIn: '180d', // 6 months (Apple max)
    issuer: teamId,
    audience: 'https://appleid.apple.com',
    subject: clientId,
    keyid: keyId,
  }
);

console.log('Paste this into Supabase → Apple → Secret Key (for OAuth):\n');
console.log(token);
