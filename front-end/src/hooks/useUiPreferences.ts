import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import appConfig from "@/config/project.config";

export type UiDensity = "compact" | "comfortable";
export type UiTextScale = "sm" | "base" | "lg";
export type UiScale = "sm" | "base" | "lg";
export type UiMotion = "auto" | "reduced";
export type UiContrast = "standard" | "high";
export type UiAnimationIntensity = "minimal" | "subtle" | "rich";

export interface UiPreferences {
  density: UiDensity;
  textScale: UiTextScale;
  uiScale: UiScale;
  motion: UiMotion;
  contrast: UiContrast;
  animationIntensity: UiAnimationIntensity;
}

const STORAGE_KEY = "battle4arena.ui.preferences.v1";

const defaults: UiPreferences = {
  density: appConfig.ui.density as UiDensity,
  textScale: appConfig.ui.textScale as UiTextScale,
  uiScale: appConfig.ui.uiScale as UiScale,
  motion: appConfig.ui.motion as UiMotion,
  contrast: appConfig.ui.contrast as UiContrast,
  animationIntensity: appConfig.ui.animationIntensity as UiAnimationIntensity,
};

const isBrowser = typeof window !== "undefined";
let snapshot: UiPreferences = defaults;
let hasHydratedSnapshot = !isBrowser;
let lastStorageValue: string | null = null;
const listeners = new Set<() => void>();

const normalizePreferences = (preferences: Partial<UiPreferences> = {}): UiPreferences => ({
  density:
    preferences.density === "compact" || preferences.density === "comfortable"
      ? preferences.density
      : defaults.density,
  textScale:
    preferences.textScale === "sm" || preferences.textScale === "base" || preferences.textScale === "lg"
      ? preferences.textScale
      : defaults.textScale,
  uiScale:
    preferences.uiScale === "sm" || preferences.uiScale === "base" || preferences.uiScale === "lg"
      ? preferences.uiScale
      : defaults.uiScale,
  motion: preferences.motion === "auto" || preferences.motion === "reduced" ? preferences.motion : defaults.motion,
  contrast:
    preferences.contrast === "standard" || preferences.contrast === "high" ? preferences.contrast : defaults.contrast,
  animationIntensity:
    preferences.animationIntensity === "minimal" ||
    preferences.animationIntensity === "subtle" ||
    preferences.animationIntensity === "rich"
      ? preferences.animationIntensity
      : defaults.animationIntensity,
});

const preferencesEqual = (first: UiPreferences, second: UiPreferences) =>
  first.density === second.density &&
  first.textScale === second.textScale &&
  first.uiScale === second.uiScale &&
  first.motion === second.motion &&
  first.contrast === second.contrast &&
  first.animationIntensity === second.animationIntensity;

const parsePreferences = (value: string | null): UiPreferences => {
  if (!value) return defaults;
  try {
    const parsed = JSON.parse(value) as Partial<UiPreferences>;
    return normalizePreferences(parsed);
  } catch {
    return defaults;
  }
};

const readSnapshot = () => {
  if (!isBrowser) return snapshot;
  if (!hasHydratedSnapshot) {
    lastStorageValue = window.localStorage.getItem(STORAGE_KEY);
    snapshot = parsePreferences(lastStorageValue);
    hasHydratedSnapshot = true;
  }
  return snapshot;
};

const notify = () => listeners.forEach((listener) => listener());

const persist = (next: UiPreferences) => {
  const normalized = normalizePreferences(next);
  if (preferencesEqual(snapshot, normalized)) return;

  snapshot = normalized;
  hasHydratedSnapshot = true;
  if (isBrowser) {
    lastStorageValue = JSON.stringify(normalized);
    window.localStorage.setItem(STORAGE_KEY, lastStorageValue);
  }
  notify();
};

const syncSnapshotFromStorage = () => {
  if (!isBrowser) return;

  const storageValue = window.localStorage.getItem(STORAGE_KEY);
  if (storageValue === lastStorageValue) return;

  const next = parsePreferences(storageValue);
  lastStorageValue = storageValue;
  hasHydratedSnapshot = true;

  if (preferencesEqual(snapshot, next)) return;
  snapshot = next;
  notify();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  if (isBrowser && listeners.size === 1) {
    window.addEventListener("storage", syncSnapshotFromStorage);
  }

  return () => {
    listeners.delete(listener);

    if (isBrowser && listeners.size === 0) {
      window.removeEventListener("storage", syncSnapshotFromStorage);
    }
  };
};

export const applyUiPreferences = (preferences: UiPreferences) => {
  if (!isBrowser) return;
  const root = document.documentElement;
  root.dataset.uiDensity = preferences.density;
  root.dataset.uiText = preferences.textScale;
  root.dataset.uiScale = preferences.uiScale;
  root.dataset.uiMotion = preferences.motion;
  root.dataset.uiContrast = preferences.contrast;
  root.dataset.uiAnimation = preferences.animationIntensity;
};

export const useUiPreferences = () => {
  const preferences = useSyncExternalStore(
    subscribe,
    readSnapshot,
    () => defaults,
  );

  useEffect(() => {
    applyUiPreferences(preferences);
  }, [preferences]);

  const setPreferences = useCallback((patch: Partial<UiPreferences>) => {
    const next = { ...readSnapshot(), ...patch };
    persist(next);
    applyUiPreferences(next);
  }, []);

  const resetPreferences = useCallback(() => {
    persist(defaults);
    applyUiPreferences(defaults);
  }, []);

  return useMemo(
    () => ({ preferences, setPreferences, resetPreferences }),
    [preferences, resetPreferences, setPreferences],
  );
};

export default useUiPreferences;
