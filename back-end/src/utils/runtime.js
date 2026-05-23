const normalize = (value) => String(value || "").trim().toLowerCase();

export const SERVER_ROLES = {
  FAST: "fast",
  REALTIME: "realtime",
  HYBRID: "hybrid",
};

export const detectPlatform = () => {
  const configured = normalize(process.env.SERVER_PLATFORM || process.env.DEPLOY_PLATFORM);
  if (configured) return configured;
  if (process.env.VERCEL) return "vercel";
  if (process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_EXTERNAL_URL) return "render";
  return "local";
};

export const detectServerRole = () => {
  const configured = normalize(process.env.SERVER_ROLE || process.env.BACKEND_ROLE);
  if (Object.values(SERVER_ROLES).includes(configured)) return configured;
  return detectPlatform() === "vercel" ? SERVER_ROLES.FAST : SERVER_ROLES.REALTIME;
};

export const getRuntimeConfig = () => {
  const platform = detectPlatform();
  const role = detectServerRole();
  const isVercel = platform === "vercel" || Boolean(process.env.VERCEL);
  const isRender = platform === "render" || Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID);
  const isLocal = platform === "local";
  const realtimeEnabled =
    !isVercel &&
    normalize(process.env.ENABLE_REALTIME ?? "true") !== "false" &&
    [SERVER_ROLES.REALTIME, SERVER_ROLES.HYBRID].includes(role);

  return {
    platform,
    role,
    isVercel,
    isRender,
    isLocal,
    isServerless: isVercel || normalize(process.env.SERVERLESS) === "true",
    realtimeEnabled,
    backgroundWorkersEnabled:
      realtimeEnabled && normalize(process.env.ENABLE_BACKGROUND_WORKERS ?? "true") !== "false",
  };
};

export const isRealtimePath = (path = "") => {
  const value = `/${String(path).replace(/^\/+/, "")}`;
  return [
    /^\/api\/v\d+\/chat(?:\/|$)/,
    /^\/api\/v\d+\/notifications(?:\/|$)/,
    /^\/api\/v\d+\/moderation(?:\/|$)/,
    /^\/api\/v\d+\/admin(?:\/|$)/,
    /^\/api\/v\d+\/tournaments\/[^/]+\/(?:notify-room|distribute-prizes)(?:\/|$)/,
  ].some((pattern) => pattern.test(value));
};
