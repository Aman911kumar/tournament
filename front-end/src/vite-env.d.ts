/// <reference types="vite/client" />

interface Window {
  FB?: {
    init: (options: {
      appId: string;
      cookie?: boolean;
      xfbml?: boolean;
      version: string;
    }) => void;
    login: (
      callback: (response: {
        authResponse?: {
          accessToken: string;
          userID?: string;
          expiresIn?: number;
          signedRequest?: string;
        };
        status?: string;
      }) => void,
      options?: { scope?: string; return_scopes?: boolean },
    ) => void;
  };
  fbAsyncInit?: () => void;
}
