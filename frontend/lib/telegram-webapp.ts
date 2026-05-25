/** Telegram Mini App helpers (https://core.telegram.org/bots/webapps) */

export type TelegramWebAppPayload =
  | { type: 'delegation_complete'; userId?: string }
  | { type: 'circle_setup_complete'; userId?: string }
  | { type: 'circle_execute_complete'; oppId?: string };

type TgWebApp = {
  ready: () => void;
  expand: () => void;
  close: () => void;
  sendData: (data: string) => void;
  colorScheme?: 'light' | 'dark';
};

function getWebApp(): TgWebApp | null {
  if (typeof window === 'undefined') return null;
  return (window as Window & { Telegram?: { WebApp?: TgWebApp } }).Telegram
    ?.WebApp ?? null;
}

export function isTelegramWebApp(): boolean {
  return getWebApp() != null;
}

/** Call on mount so the mini-app fills the modal and shows the header */
export function initTelegramWebApp(): void {
  const app = getWebApp();
  if (!app) return;
  app.ready();
  app.expand();
}

/** Send result to the bot and close the modal — user returns to the chat */
export function finishTelegramWebApp(payload: TelegramWebAppPayload): void {
  const app = getWebApp();
  if (!app) return;
  try {
    app.sendData(JSON.stringify(payload));
  } finally {
    app.close();
  }
}
