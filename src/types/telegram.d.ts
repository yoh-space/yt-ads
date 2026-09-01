export {};

declare global {
  interface Window {
    /**
     * Minimal Telegram WebApp bridge for the embedded Mini App. Only present
     * when the page is opened inside a Telegram client via a WebApp button.
     */
    Telegram?: {
      WebApp?: {
        ready(): void;
        expand?(): void;
        close?(): void;
        colorScheme?: "light" | "dark";
        initData?: string;
        initDataUnsafe?: Record<string, unknown>;
        sendData(data: string): void;
        openLink?(url: string): void;
      };
    };
  }
}