# Battle4Arena Configuration

Battle4Arena now uses config files for safe project settings and `.env` files for secrets only.

## Backend

Safe defaults live in:

- `back-end/config/project.config.js`

The backend loads `.env` first, then fills missing non-secret values from the config file through `back-end/env.js`.

Keep these in `back-end/.env` or hosting dashboards:

- MongoDB URI
- JWT secrets
- OAuth client secrets
- payment secrets
- SMTP users/passwords
- TeleStore API key/secret
- VAPID private key
- Redis URLs and queue encryption keys
- internal service secrets

Use hosting dashboard overrides for deployment behavior:

- Vercel fast API: `SERVER_ROLE=fast`, `SERVER_PLATFORM=vercel`
- Render realtime API: `SERVER_ROLE=realtime`, `SERVER_PLATFORM=render`

## Frontend

Safe public defaults live in:

- `front-end/src/config/project.config.ts`

Frontend `.env` values are bundled into the browser. Only put public IDs or build-time public overrides there.

Keep these out of frontend env files:

- database URI
- JWT secrets
- SMTP passwords
- OAuth client secrets
- Razorpay secret
- TeleStore secret
- VAPID private key

## Rule

If a value is safe to commit and useful across all environments, put it in the config file.
If a value grants access, signs tokens, pays money, sends email, or identifies private infrastructure, keep it in `.env` or the hosting dashboard.
