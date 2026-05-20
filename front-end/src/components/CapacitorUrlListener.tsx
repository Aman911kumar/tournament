import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";

const tryCloseBrowser = async () => {
  try {
    await Browser.close();
  } catch {
    // no-op (Android doesn't support programmatic close)
  }
};

const getSlugFromUrl = (urlString: string) => {
  try {
    const url = new URL(urlString);
    const path = url.pathname || "/";
    const search = url.search || "";
    return `${path}${search}`;
  } catch {
    return null;
  }
};

export default function CapacitorUrlListener() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleUrl = async (url: string) => {
      const slug = getSlugFromUrl(url);
      if (!slug) return;
      await tryCloseBrowser();
      navigate(slug, { replace: true });
    };

    const sub = App.addListener("appUrlOpen", (event) => {
      if (event?.url) void handleUrl(event.url);
    });

    // Handle cold start (app opened via deep link)
    void App.getLaunchUrl().then((res) => {
      if (res?.url) void handleUrl(res.url);
    });

    return () => {
      void sub.then((h) => h.remove()).catch(() => undefined);
    };
  }, [navigate]);

  return null;
}

