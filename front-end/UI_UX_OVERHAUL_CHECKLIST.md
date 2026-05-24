# Battle4Arena Frontend UI/UX Overhaul Checklist

## Research Inputs

- Mobile touch targets: keep primary actions near 44-48px effective touch size.
- Motion accessibility: respect `prefers-reduced-motion` and provide an in-app reduced motion setting.
- Dark UI readability: use deep gray surfaces, high foreground contrast, and restrained accents.
- Mobile performance: prefer color, borders, and simple transforms over heavy blur/shadow effects.

## Global System

- [x] Palette aligned to Battle4Arena esports dark system.
- [x] Compact surface, border, radius, shadow, and spacing defaults.
- [x] Reduced-motion CSS fallback.
- [x] Persistent UI preferences for density, text scale, UI scale, contrast, motion, and animation intensity.
- [x] Bottom navigation compacted for mobile/APK safe areas.
- [x] Removed duplicate protected route shell wrapper.
- [x] Shared `Surface`, `StatusPill`, `SkeletonBlock`, `ActionButton`, and `SearchBox` tightened.
- [x] Shared buttons and legacy `GlassCard` reduced in visual bulk.
- [x] `Surface` padding override bug fixed so page-level compact/mobile padding now works.
- [x] Always-mounted bottom navigation no longer depends on layout animation.
- [x] Shared skeletons moved from generic pulsing blocks to lightweight shimmer with reduced-motion support.
- [x] Mobile root safe-area handling cleaned so fixed navigation owns bottom spacing.
- [x] Heavy decorative landing-page blur fields reduced into lightweight dark esports gradients.

## Page Inventory Audited

- [x] Home / discovery
- [x] Tournament listing
- [x] Channel search
- [x] Creator profile
- [x] Profile
- [x] Notifications
- [x] Help center
- [x] Rules
- [x] Privacy policy
- [x] OAuth callback
- [x] Email / phone verification
- [x] Forgot password request / OTP / expired states
- [x] Change password
- [x] Wallet and wallet subflows
- [x] Tournament details
- [x] Tournament chat
- [x] Create tournament
- [x] My tournaments
- [x] Game accounts
- [x] Creator dashboard
- [x] Admin screens
- [x] Legal center

## Remaining Recommended Phase

- [ ] Deep rewrite of very large admin dashboard tables into virtualized mobile cards.
- [ ] Visual regression screenshots on real Android / Capacitor build.
- [ ] Optional page-by-page Playwright snapshot baseline.
