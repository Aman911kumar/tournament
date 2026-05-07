# FF Tournament Frontend

A fast, mobile-first React frontend for a Free Fire tournament platform. The app covers player tournament discovery, wallet payments, creator tools, admin operations, notifications, ratings, and secure room detail access for joined players.

This README is written to help you run the project quickly, understand where important code lives, and make future upgrades without digging through the full app every time.

## What This App Does

- Lets users browse, join, and track tournaments.
- Shows room ID and password only to joined users, tournament organizers, and admins.
- Provides wallet flows for add money, withdraw, transfer, payment status, and transaction details.
- Integrates Razorpay checkout through the backend payment flow.
- Supports creator profiles, creator ratings, creator dashboards, and tournament creation.
- Uses admin-only screens for users, tournaments, payments, withdrawals, creator requests, audit records, and database details.
- Shows notifications for tournament updates, room details, creator approval/rejection, and payment activity.
- Uses cache-first loading on key screens so users see saved data immediately while fresh data loads in the background.

## Tech Stack

- React 18
- TypeScript
- Vite
- React Router
- TanStack Query
- Tailwind CSS
- Radix UI and shadcn-style components
- Framer Motion
- Sonner toasts
- Lucide icons
- Razorpay checkout types
- Google OAuth
- Facebook Login SDK
- Vitest

## Project Structure

```txt
front-end/
  src/
    api/              API wrappers and shared API client
    assets/           Static images used by the UI
    components/       Reusable app components and UI primitives
    hooks/            Shared React hooks
    lib/              Auth storage, cache helpers, utilities
    pages/            Route-level screens
    test/             Vitest setup and tests
    App.tsx           Route map and app providers
    main.tsx          React entry point
  index.html
  vite.config.ts
  package.json
```

## Quick Start

Install dependencies:

```sh
npm install
```

Create a local env file:

```sh
cp .env.example .env
```

If `.env.example` does not exist yet, create `front-end/.env` manually using the variables in the next section.

Start the development server:

```sh
npm run dev
```

The Vite dev server runs on:

```txt
http://localhost:8080
```

The backend should be running separately. The frontend reads the backend URL from `VITE_API_BASE_URL`.

## Environment Variables

Create `front-end/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_FACEBOOK_APP_ID=your-facebook-app-id
VITE_FACEBOOK_GRAPH_VERSION=v25.0
```

Use the backend port that your server actually runs on. If your backend is running at `http://localhost:3000`, use:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

### Facebook Login Note

Facebook login does not work on normal `http://` pages. Meta blocks `FB.login` on insecure origins. For local testing, use Google login, email/password login, or run the app through HTTPS.

## Available Scripts

```sh
npm run dev
```

Starts Vite at `http://localhost:8080`.

```sh
npm run build
```

Builds the production bundle into `dist/`.

```sh
npm run build:dev
```

Builds using development mode.

```sh
npm run preview
```

Previews the built app locally.

```sh
npm run serve
```

Runs Vite preview on `0.0.0.0` so it can be accessed from other devices on the network.

```sh
npm run lint
```

Runs ESLint.

```sh
npm run test
```

Runs Vitest once.

```sh
npm run test:watch
```

Runs Vitest in watch mode.

## Main Routes

| Route | Purpose |
| --- | --- |
| `/login` | Login and social auth |
| `/` | Home dashboard |
| `/tournaments` | Tournament listing and search |
| `/tournament/:id` | Tournament details, rules, joined status, room details |
| `/tournament/:id/slots` | Slot selection |
| `/tournament/:id/comments` | Tournament comments |
| `/tournament/:id/distribute-prizes` | Prize distribution flow |
| `/my-tournaments` | User registrations and joined tournaments |
| `/wallet` | Wallet balance, wallet transactions, payment activity |
| `/wallet/add` | Add money through Razorpay |
| `/wallet/withdraw` | Withdraw request |
| `/wallet/transfer` | Wallet-to-wallet transfer |
| `/wallet/transaction/:id` | Wallet transaction details |
| `/wallet/payment/:id` | Payment activity details |
| `/profile` | User profile |
| `/edit-profile` | Edit user profile |
| `/change-password` | Password update |
| `/game-accounts` | User game IDs and accounts |
| `/creator/:id` | Creator profile and rating |
| `/creator-dashboard` | Creator dashboard and tournament management |
| `/create-tournament` | Create tournament |
| `/edit-tournament/:id` | Edit tournament |
| `/notifications` | User notifications |
| `/subscriptions` | Creator/channel discovery |
| `/admin` | Admin dashboard |
| `/admin/details/:section` | Admin detail pages |

## Core Frontend Concepts

### API Client

All API requests should go through:

```txt
src/api/client.ts
```

`apiFetch` automatically:

- Uses `VITE_API_BASE_URL`.
- Sends `credentials: "include"`.
- Adds the bearer access token from local auth storage.
- Clears auth and redirects to `/login` on `401`.
- Wraps backend and network errors in `ApiError`.
- Preserves backend request IDs when available.

When adding a new API module, place it in `src/api/` and reuse `apiFetch`.

### Auth Storage

Auth token helpers live in:

```txt
src/lib/auth-storage.ts
```

Use these helpers instead of reading or writing auth tokens directly from screens.

### Cache-First Loading

Cache helpers live in:

```txt
src/lib/offline-cache.ts
```

Important screens read cached data first, render immediately, and then replace it with fresh API data. This makes the app feel faster when the database or network is slow.

Current cache-first areas include:

- Home
- Tournament listing
- Tournament details
- Creator dashboard
- Creator profile
- Subscriptions/channels
- Notifications
- My registrations

When adding cache to another screen:

1. Add a stable key in `CACHE_KEYS`.
2. Read cached data before the API request.
3. Render cached data with a subtle refresh/loading state.
4. Save fresh API data after the request succeeds.
5. Avoid caching sensitive data such as tokens, passwords, or private payment secrets.

### Protected Routes

Most app routes are wrapped by:

```txt
src/components/ProtectedRoute.tsx
```

Authenticated pages are rendered inside the protected shell, which also includes the bottom navigation.

### Notifications

Notification UI lives in:

```txt
src/pages/NotificationsScreen.tsx
src/api/notifications.ts
```

Notifications are used for payment updates, creator request results, tournament room details, and other important user-visible events.

### Wallet And Payments

Wallet screens live in:

```txt
src/pages/WalletScreen.tsx
src/pages/AddMoneyScreen.tsx
src/pages/WithdrawScreen.tsx
src/pages/TransferMoneyScreen.tsx
src/pages/TransactionDetailScreen.tsx
src/pages/PaymentDetailScreen.tsx
src/api/wallet.ts
```

Frontend payment flow should stay simple:

- The backend creates Razorpay orders.
- Razorpay checkout collects the payment method.
- The backend verifies payment signatures.
- The wallet screen separates wallet transactions from payment activity.
- Payment details show provider status such as initiated, success, failed, or cancelled.

Do not put Razorpay key secrets in frontend env files.

### Creator Flow

Creator pages live in:

```txt
src/pages/CreatorDashboardScreen.tsx
src/pages/CreatorProfileScreen.tsx
src/pages/CreateTournamentScreen.tsx
src/api/creators.ts
```

Users cannot become creators directly. They request creator access, then an admin approves or rejects the request. Admins can also remove creator access and send a removal message.

### Admin Flow

Admin pages live in:

```txt
src/pages/AdminDashboardScreen.tsx
src/pages/AdminDetailScreen.tsx
src/api/admin.ts
```

Admin screens are designed for:

- Platform overview
- Finance and wallet flow
- Payments and withdrawals
- Tournament records
- Creator requests
- User records
- Support records
- Audit logs
- Database collection details with sensitive fields redacted by the backend

Admin-only permissions must still be enforced by the backend. Frontend route hiding is only a usability layer.

## UI Guidelines For This App

- Keep pages mobile-first.
- Use bottom navigation for primary user routes.
- Use compact, scan-friendly admin layouts.
- Prefer clear status colors for payment and transaction states.
- Keep payment method selection out of the add-money page because Razorpay provides that UI.
- Use skeleton loading on slow screens instead of blank panels.
- Keep room ID/password hidden unless the backend says the current user can view them.
- Avoid showing raw JSON to users unless it is inside an admin/debug details section.

## Production Build And Hosting

Build the app:

```sh
npm run build
```

Preview the production build:

```sh
npm run preview
```

This app uses React Router `BrowserRouter`, so production hosting must support SPA fallback.

For every unknown frontend route, the server must return:

```txt
dist/index.html
```

Without this fallback, refreshing routes like `/wallet`, `/admin`, or `/tournament/123` will return a server 404.

## Troubleshooting

### The app cannot reach the backend

Check `VITE_API_BASE_URL` in `front-end/.env`.

Example:

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

Restart Vite after changing env files.

### Facebook login is not working locally

Facebook blocks `FB.login` on normal HTTP pages. Use HTTPS or test another login method locally.

### Google login fails to load

Check:

- `VITE_GOOGLE_CLIENT_ID` is set.
- The Google OAuth app allows the current origin.
- The browser is not blocking third-party scripts.

### Refreshing a route gives 404 in production

Your host is missing SPA fallback to `index.html`.

### User gets logged out after an API call

The backend returned `401`. The API client clears auth tokens and redirects to `/login` automatically.

### Cached data looks old for a moment

This is expected on cache-first screens. The page renders saved data first, then refreshes from the backend.

## Adding A New Page

1. Create the screen in `src/pages/`.
2. Add API functions in `src/api/` if needed.
3. Add the route in `src/App.tsx`.
4. Add navigation only if the page is a primary workflow.
5. Use `apiFetch` for backend calls.
6. Use `offline-cache.ts` when the screen benefits from cache-first loading.
7. Add skeleton or loading states for slow network paths.
8. Keep admin-only or creator-only rules enforced by backend endpoints.

## Code Style Notes

- Use the existing `@/` alias for imports from `src`.
- Keep route screens focused on page behavior.
- Move repeated API logic into `src/api/`.
- Move shared UI into `src/components/`.
- Keep raw backend shapes out of the UI when a small formatter makes the screen easier to understand.
- Prefer readable helper names over clever one-line transformations.
- Keep sensitive data out of local storage and out of rendered UI.

## Before Shipping Changes

Run:

```sh
npm run build
npm run test
```

Run lint when changing shared components or larger areas:

```sh
npm run lint
```

Also manually check:

- Login
- Home
- Tournament details
- Wallet add money
- Wallet transactions and payments
- Creator dashboard
- Admin dashboard
- Notifications
- Mobile viewport

## Backend Pairing

This frontend expects the backend to provide:

- Auth endpoints
- User profile endpoints
- Tournament endpoints
- Wallet and payment endpoints
- Razorpay order and verification endpoints
- Creator request and rating endpoints
- Notification endpoints
- Admin dashboard and admin details endpoints

Keep frontend and backend response contracts aligned. When backend fields change, update the matching `src/api/` module first, then adjust the page UI.
