# Battle4Arena UI Simplification Audit

Date: 2026-06-15

Scope: every `*.tsx` screen under `front-end/src/pages`. No app-router `page.tsx` files exist in this repo; the page folder contains the app screens listed below.

## Applied Globally

- [x] Reduced large spacing utilities inside the app shell on desktop and mobile.
- [x] Reduced bulky nested card/panel visuals into simple separators.
- [x] Normalized wallet/payment/tournament local panel classes.
- [x] Second-pass simplification: removed low-value marketing/helper blocks from high-traffic screens.
- [x] Second-pass simplification: collapsed secondary tournament actions behind one compact control.
- [x] Second-pass simplification: kept one dominant action visible on home, tournament detail, wallet, and notifications.
- [x] Preserved forms, media, chat, and controls so existing flows keep working.
- [x] Kept API, React Query, Socket.IO, routing, and business logic untouched.
- [x] Kept mobile-first text wrapping and auto grid sizing active.
- [x] Kept skeleton loading on the newer `b4a-skeleton` system.

## Second-Pass Cognitive Load Rules

- [x] 3-second rule: primary action is visible without scanning helper copy.
- [x] Delete test: removed sections that did not help the next user action.
- [x] 80/20 rule: kept frequent actions visible; moved/removed rare supporting prompts.
- [x] Visual economy: reduced repeated cards, stats, and explanatory notes that competed with core workflows.

## Page Checklist

- [x] `AddMoneyScreen.tsx` - Wallet flow panels compacted globally.
- [x] `AdminDashboardScreen.tsx` - Heavy GlassCard usage included in nested-card flattening.
- [x] `AdminDetailScreen.tsx` - Empty/detail blocks included in compact spacing rules.
- [x] `AdminModerationScreen.tsx` - Report cards inherit compact GlassCard rules.
- [x] `ChangePasswordScreen.tsx` - Auth/security panels inherit compact Surface rules.
- [x] `ChannelSetupScreen.tsx` - Creator setup cards inherit compact GlassCard rules.
- [x] `CreateTournamentScreen.tsx` - Form sections inherit compact Surface and spacing rules.
- [x] `CreatorDashboardScreen.tsx` - Dashboard cards inherit compact GlassCard rules.
- [x] `CreatorProfileScreen.tsx` - Profile/event surfaces inherit compact spacing and separators.
- [x] `EditProfileScreen.tsx` - Verification/profile panels inherit compact GlassCard rules.
- [x] `ForgotPasswordExpiredScreen.tsx` - Auth flow inherits compact PageShell/Surface rules.
- [x] `ForgotPasswordOtpScreen.tsx` - OTP flow inherits compact page spacing.
- [x] `ForgotPasswordRequestScreen.tsx` - Request flow inherits compact PageShell/Surface rules.
- [x] `ForgotPasswordResetScreen.tsx` - Reset flow inherits compact GlassCard rules.
- [x] `GameAccountsScreen.tsx` - Game account cards inherit compact GlassCard rules.
- [x] `GoogleOnboardingScreen.tsx` - Onboarding panel spacing included in global compact rules.
- [x] `HelpCenterScreen.tsx` - Legal/help surfaces inherit compact Surface rules.
- [x] `Index.tsx` - Home dashboard inherits compact Surface rules.
- [x] `LandingPage.tsx` - Large visual sections inherit reduced radius/blur/shadow rules.
- [x] `LegalCenterScreen.tsx` - Docs cards inherit nested-card simplification.
- [x] `LoginScreen.tsx` - Auth cards inherit compact spacing and blur removal.
- [x] `MyTournamentsScreen.tsx` - Tournament list surfaces inherit compact Surface rules.
- [x] `NotFound.tsx` - Error state inherits compact Surface rules.
- [x] `NotificationsScreen.tsx` - Notification list cards inherit compact Surface rules.
- [x] `OAuthCallbackScreen.tsx` - Callback panel inherits compact Surface rules.
- [x] `PaymentDetailScreen.tsx` - Wallet detail panels compacted globally.
- [x] `PrivacyPolicyScreen.tsx` - Policy surfaces inherit compact Surface rules.
- [x] `PrizeDistributionScreen.tsx` - Prize/admin cards inherit compact GlassCard rules.
- [x] `ProfileScreen.tsx` - Profile surfaces inherit compact spacing and separators.
- [x] `RulesScreen.tsx` - Rules surfaces inherit compact Surface rules.
- [x] `SlotSelectionScreen.tsx` - Slot cards inherit compact GlassCard rules.
- [x] `SubscriptionsScreen.tsx` - Creator discovery surfaces inherit compact Surface rules.
- [x] `test.tsx` - Test route inherits compact Surface rules.
- [x] `TournamentCommentsScreen.tsx` - Chat bubbles and states inherit radius/shadow simplification.
- [x] `TournamentDetailScreen.tsx` - Tournament sections compacted globally.
- [x] `TournamentsScreen.tsx` - Search/filter/card surfaces inherit compact Surface rules.
- [x] `TransactionDetailScreen.tsx` - Wallet detail panels compacted globally.
- [x] `TransferMoneyScreen.tsx` - Transfer panels inherit wallet panel simplification.
- [x] `TransferPinSetupScreen.tsx` - PIN setup panel inherits wallet panel simplification.
- [x] `VerifyEmailScreen.tsx` - Verification panel inherits compact Surface rules.
- [x] `VerifyPhoneScreen.tsx` - Verification panel inherits compact Surface rules.
- [x] `WalletScreen.tsx` - Wallet hero, actions, and transaction surfaces compacted globally.
- [x] `WithdrawScreen.tsx` - Withdraw panels compacted globally.

## Follow-Up Priority If More Manual Per-Page Work Is Needed

1. Admin dashboard/detail: large files with many local `GlassCard` blocks.
2. Landing page: mostly public marketing layout, should be manually balanced after screenshots.
3. Creator dashboard and prize distribution: dense data screens with many local sections.
4. Chat and tournament detail: behavior-heavy screens, should be screenshot-tested after any deeper markup edit.
