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
        initDataUnsafe?: {
          /** The Telegram account the Mini App is opened for. */
          user?: {
            id: number;
            first_name?: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
          };
        };
        sendData(data: string): void;
        openLink?(url: string): void;
      };
    };
  }
}