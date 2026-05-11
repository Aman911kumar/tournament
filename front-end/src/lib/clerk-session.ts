type ClerkTokenGetter = () => Promise<string | null>;
type ClerkSignOutHandler = () => Promise<void> | void;

let clerkTokenGetter: ClerkTokenGetter | null = null;
let clerkSignOutHandler: ClerkSignOutHandler | null = null;

export const isClerkConfigured = () => Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

export const setClerkTokenGetter = (getter: ClerkTokenGetter | null) => {
  clerkTokenGetter = getter;
};

export const getClerkAccessToken = async () => {
  if (!clerkTokenGetter) return null;
  try {
    return await clerkTokenGetter();
  } catch {
    return null;
  }
};

export const setClerkSignOutHandler = (handler: ClerkSignOutHandler | null) => {
  clerkSignOutHandler = handler;
};

export const signOutClerkSession = async () => {
  if (!clerkSignOutHandler) return;
  try {
    await clerkSignOutHandler();
  } catch {
    // Keep local logout flow resilient if Clerk is temporarily unreachable.
  }
};
