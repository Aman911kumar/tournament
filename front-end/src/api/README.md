# API Layer

One file per page/feature. Every function currently returns mock data — replace the commented `apiFetch(...)` line with the real call when your backend is ready.

## Configure base URL
Set `VITE_API_BASE_URL` (e.g. `https://api.battlearena.com`) in your environment. `client.ts` reads it.

## Files
- `client.ts` — shared `apiFetch` wrapper + `ApiError`
- `auth.ts` — LoginScreen
- `home.ts` — Index (Home Feed)
- `tournaments.ts` — TournamentsScreen, TournamentDetailScreen, CreateTournamentScreen, TournamentCommentsScreen
- `wallet.ts` — WalletScreen, AddMoneyScreen, WithdrawScreen
- `profile.ts` — ProfileScreen, EditProfileScreen
- `creators.ts` — CreatorProfileScreen, CreatorDashboardScreen, SubscriptionsScreen
- `notifications.ts` — NotificationsScreen

## Usage example
```ts
import { getTournaments } from "@/api/tournaments";

const data = await getTournaments({ game: "Free Fire", type: "paid" });
```
