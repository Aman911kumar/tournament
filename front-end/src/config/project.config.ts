/**
 * Battle4Arena frontend project configuration.
 *
 * This file is bundled into the browser, so keep only public settings here.
 * Use `.env` only for build-time overrides and public provider IDs. Never put
 * API secrets, SMTP passwords, database URIs, or private keys in frontend env.
 */

export const PROJECT_CONFIG = {
  api: {
    localBaseUrl: "http://localhost:3000/api/v1",
    fastProductionBaseUrl: "https://api.battle4arena.fun/api/v1",
    realtimeProductionBaseUrl: "https://realtime.battle4arena.fun/api/v1",
    timeoutMs: {
      development: 20_000,
      production: 45_000,
    },
    slowRequestMs: {
      development: 1_000,
      production: 2_500,
    },
    performanceLogs: false,
    realtimeWakeupCooldownMs: 120_000,
  },
  auth: {
    deepLinkScheme: "battle4arena",
    facebookGraphVersion: "v25.0",
  },
  voice: {
    iceServers: "",
  },
  ui: {
    density: "compact",
    textScale: "base",
    uiScale: "base",
    motion: "auto",
    contrast: "standard",
    animationIntensity: "subtle",
  },
} as const;

const readEnv = (key: string) =>
  String((import.meta.env as Record<string, unknown>)[key] || "").trim();

export const publicEnv = {
  apiBaseUrl: readEnv("VITE_API_BASE_URL"),
  fastApiBaseUrl: readEnv("VITE_FAST_API_BASE_URL"),
  realtimeApiBaseUrl: readEnv("VITE_REALTIME_API_BASE_URL"),
  socketApiBaseUrl: readEnv("VITE_SOCKET_API_BASE_URL"),
  productionApiBaseUrl: readEnv("VITE_PRODUCTION_API_BASE_URL"),
  productionRealtimeApiBaseUrl: readEnv("VITE_PRODUCTION_REALTIME_API_BASE_URL"),
  apiTimeoutMs: readEnv("VITE_API_TIMEOUT_MS"),
  apiSlowRequestMs: readEnv("VITE_API_SLOW_REQUEST_MS"),
  apiPerfLogs: readEnv("VITE_API_PERF_LOGS"),
  realtimeWakeupCooldownMs: readEnv("VITE_REALTIME_WAKEUP_COOLDOWN_MS"),
  deepLinkScheme: readEnv("VITE_APP_DEEPLINK_SCHEME"),
  googleClientId: readEnv("VITE_GOOGLE_CLIENT_ID"),
  facebookAppId: readEnv("VITE_FACEBOOK_APP_ID"),
  facebookGraphVersion: readEnv("VITE_FACEBOOK_GRAPH_VERSION"),
  voiceIceServers: readEnv("VITE_VOICE_ICE_SERVERS"),
  clerkPublishableKey: readEnv("VITE_CLERK_PUBLISHABLE_KEY"),
};

export const appConfig = {
  api: {
    localBaseUrl: publicEnv.apiBaseUrl || PROJECT_CONFIG.api.localBaseUrl,
    fastBaseUrl:
      publicEnv.fastApiBaseUrl ||
      publicEnv.apiBaseUrl ||
      PROJECT_CONFIG.api.localBaseUrl,
    realtimeBaseUrl:
      publicEnv.realtimeApiBaseUrl ||
      publicEnv.socketApiBaseUrl ||
      publicEnv.apiBaseUrl ||
      (import.meta.env.DEV
        ? PROJECT_CONFIG.api.localBaseUrl
        : PROJECT_CONFIG.api.realtimeProductionBaseUrl),
    fastProductionBaseUrl:
      publicEnv.productionApiBaseUrl || PROJECT_CONFIG.api.fastProductionBaseUrl,
    realtimeProductionBaseUrl:
      publicEnv.productionRealtimeApiBaseUrl ||
      PROJECT_CONFIG.api.realtimeProductionBaseUrl,
    timeoutMs: Number(
      publicEnv.apiTimeoutMs ||
        (import.meta.env.PROD
          ? PROJECT_CONFIG.api.timeoutMs.production
          : PROJECT_CONFIG.api.timeoutMs.development),
    ),
    slowRequestMs: Number(
      publicEnv.apiSlowRequestMs ||
        (import.meta.env.PROD
          ? PROJECT_CONFIG.api.slowRequestMs.production
          : PROJECT_CONFIG.api.slowRequestMs.development),
    ),
    performanceLogs:
      publicEnv.apiPerfLogs.toLowerCase() === "true" ||
      (!publicEnv.apiPerfLogs && PROJECT_CONFIG.api.performanceLogs) ||
      import.meta.env.DEV,
    realtimeWakeupCooldownMs: Number(
      publicEnv.realtimeWakeupCooldownMs ||
        PROJECT_CONFIG.api.realtimeWakeupCooldownMs,
    ),
  },
  auth: {
    deepLinkScheme: publicEnv.deepLinkScheme || PROJECT_CONFIG.auth.deepLinkScheme,
    googleClientId: publicEnv.googleClientId,
    facebookAppId: publicEnv.facebookAppId,
    facebookGraphVersion:
      publicEnv.facebookGraphVersion || PROJECT_CONFIG.auth.facebookGraphVersion,
    clerkPublishableKey: publicEnv.clerkPublishableKey,
  },
  voice: {
    iceServers: publicEnv.voiceIceServers || PROJECT_CONFIG.voice.iceServers,
  },
  ui: PROJECT_CONFIG.ui,
} as const;

export default appConfig;
