# Battle4Arena Mobile-First UI Reference Checklist

This checklist maps every `front-end/src/pages` screen to the provided `all pages images` reference pack. The original zip files are kept untouched; the reference pack was only read/extracted to a temporary folder for inspection.

## Reference Design Rules Applied Globally

- [x] Use tactical dark base surfaces: `#0D1117`, `#121212`, `#161B22`, and `#1A1F2B`.
- [x] Use cyan, purple, green, orange, and red only for hierarchy, status, and actions.
- [x] Keep the app mobile-first with dense 4px rhythm and compact professional spacing.
- [x] Reduce large rounded corners and oversized button/card shapes.
- [x] Keep bottom navigation solid and docked with a clear active top indicator.
- [x] Disable heavy blur and shadow effects for low-end Android and Capacitor WebView smoothness.
- [x] Fix mobile viewport metadata with `viewport-fit=cover` for safe-area behavior.
- [x] Normalize non-avatar cover image positioning and preserve avatar crop behavior.
- [x] Use stable `100dvh` page height behavior to reduce mobile browser jumpiness.
- [x] Keep shared buttons, panels, inputs, skeletons, and cards visually consistent through the design system.

## Shared Components Checked

- [x] `App.tsx` route shell and mobile route loading.
- [x] `BottomNav.tsx` solid mobile navigation dock.
- [x] `design-system.tsx` shared page shell, surfaces, buttons, cards, search, segmented controls, tables, dialogs.
- [x] `ui/button.tsx` compact button hierarchy.
- [x] `ui/avatar.tsx` avatar crop preservation.
- [x] `GameArtImage.tsx` game media loading and crop behavior.
- [x] `index.css` global mobile-first tokens, safe-area spacing, reduced blur/shadow, image crop defaults.

## Page-by-Page Reference Map

| Page | Route Area | Reference Folder | Status |
| --- | --- | --- | --- |
| `AddMoneyScreen.tsx` | Wallet deposit | `add_money_tactical` | [x] Mobile-first wallet/payment style covered |
| `AdminDashboardScreen.tsx` | Admin home | `admin_command_center` + `gamer_os_tactical` | [x] Shared admin shell covered |
| `AdminDetailScreen.tsx` | Admin detail | `admin_command_center` + `moderation_hub_admin_review` | [x] Shared admin/detail density covered |
| `AdminModerationScreen.tsx` | Moderation | `moderation_hub_admin_review` | [x] Tactical review layout covered |
| `ChangePasswordScreen.tsx` | Security | `security_change_password` | [x] Compact security form covered |
| `ChannelSetupScreen.tsx` | Creator setup | `channel_setup_true_dark` | [x] Creator setup layout covered |
| `CreateTournamentScreen.tsx` | Tournament creation | `create_tournament_advanced` | [x] Advanced form style covered |
| `CreatorDashboardScreen.tsx` | Organizer console | `creator_dashboard_organizer_console` | [x] Organizer command layout covered |
| `CreatorProfileScreen.tsx` | Public creator | `creator_profile_public_identity` | [x] Banner/avatar identity covered |
| `EditProfileScreen.tsx` | Profile editing | `edit_profile_dark_tactical` | [x] Tactical identity editor covered |
| `ForgotPasswordExpiredScreen.tsx` | Recovery expired | `account_recovery_forgot_password` | [x] Recovery state covered |
| `ForgotPasswordOtpScreen.tsx` | OTP verification | `account_recovery_forgot_password` | [x] OTP/recovery state covered |
| `ForgotPasswordRequestScreen.tsx` | Forgot password | `account_recovery_forgot_password` | [x] Account identification covered |
| `ForgotPasswordResetScreen.tsx` | Reset password | `account_recovery_forgot_password` + `security_change_password` | [x] Secure reset form covered |
| `GameAccountsScreen.tsx` | Game IDs | `game_accounts_identity_hub` | [x] Identity hub covered |
| `GoogleOnboardingScreen.tsx` | Onboarding | `account_onboarding_tactical` | [x] Mobile onboarding covered |
| `HelpCenterScreen.tsx` | Support | `help_center_support_portal` | [x] Support portal covered |
| `Index.tsx` | Home | `landing_page_gamer_os` + `gamer_os_tactical` | [x] Home gamer OS style covered |
| `LandingPage.tsx` | Public landing | `landing_page_gamer_os` | [x] Landing visual language covered |
| `LegalCenterScreen.tsx` | Legal docs | `legal_center_documentation` | [x] Documentation layout covered |
| `LoginScreen.tsx` | Auth entry | `auth_entry_immersive` | [x] Auth entry style covered |
| `MyTournamentsScreen.tsx` | Joined tournaments | `my_tournaments_command_center` | [x] Command list layout covered |
| `NotFound.tsx` | 404 | `404_not_found_restricted_sector` | [x] Restricted-sector state covered |
| `NotificationsScreen.tsx` | Notifications | `notifications_event_log` | [x] Event log style covered |
| `OAuthCallbackScreen.tsx` | OAuth callback | `identity_verification_success` | [x] Verification/callback state covered |
| `PaymentDetailScreen.tsx` | Payment details | `transaction_receipt_details` | [x] Receipt details covered |
| `PrivacyPolicyScreen.tsx` | Privacy | `legal_center_documentation` | [x] Legal doc style covered |
| `PrizeDistributionScreen.tsx` | Prize payout | `payout_results_control` | [x] Payout control style covered |
| `ProfileScreen.tsx` | User profile | `profile_clean` | [x] Profile identity structure covered |
| `RulesScreen.tsx` | Rules | `legal_center_documentation` | [x] Legal/rules doc style covered |
| `SlotSelectionScreen.tsx` | Slot selection | `slot_selection_grid` | [x] Mobile grid style covered |
| `SubscriptionsScreen.tsx` | Channel discovery | `creators_discovery_subscriptions` | [x] Creator discovery style covered |
| `TournamentCommentsScreen.tsx` | Chat/comms | `tournament_comms_chat` | [x] Chat dock and realtime style covered |
| `TournamentDetailScreen.tsx` | Tournament detail | `tournament_detail_precision` | [x] Tournament detail style covered |
| `TournamentsScreen.tsx` | Tournament feed | `tournaments_feed_refined` | [x] Feed filters/cards covered |
| `TransactionDetailScreen.tsx` | Transaction receipt | `transaction_receipt_details` | [x] Receipt layout covered |
| `TransferMoneyScreen.tsx` | Wallet transfer | `transfer_money_secure` | [x] Secure transfer style covered |
| `TransferPinSetupScreen.tsx` | Transfer PIN | `security_setup_transfer_pin` | [x] PIN setup style covered |
| `VerifyEmailScreen.tsx` | Email verification | `identity_verification_success` | [x] Verification success style covered |
| `VerifyPhoneScreen.tsx` | Phone verification | `identity_verification_success` | [x] Verification success style covered |
| `WalletScreen.tsx` | Wallet dashboard | `wallet_tactical` | [x] Tactical fintech style covered |
| `WithdrawScreen.tsx` | Withdrawal | `withdrawal_payout_hub` | [x] Payout/withdraw style covered |
| `test.tsx` | Internal test route | `gamer_os_tactical` | [x] Shared shell covered |

## Mobile QA Checklist

- [x] Every protected page has bottom-nav safe-area spacing.
- [x] Fullscreen chat pages avoid duplicate bottom navigation.
- [x] Search, filter, tab, and segmented controls remain horizontally usable on small screens.
- [x] Inputs use 16px text to prevent mobile browser zoom.
- [x] Panels use solid dark surfaces instead of transparent overlays.
- [x] Images use stable object-fit behavior and avoid avatar crop regressions.
- [x] Large desktop cards are tightened through shared spacing/radius tokens.
- [x] Reduced-motion users and low-end devices avoid heavy animation/blur.
