import { API_BASE_URL } from "@/api/client";

export const resolveAbsoluteApiUrl = (path: string) => {
  if (path.startsWith("http")) return path;

  const base = API_BASE_URL;
  if (base.startsWith("http")) return `${base}${path}`;

  // Browser context: build absolute using current origin
  if (typeof window !== "undefined") {
    return new URL(`${base}${path}`, window.location.origin).toString();
  }

  return `${base}${path}`;
};

