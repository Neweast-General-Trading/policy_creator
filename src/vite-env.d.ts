/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_APP_MODE?: string;
  readonly VITE_PUBLIC_REDIRECT_URI?: string;
  readonly VITE_INTRANET_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
