import Script from 'next/script';
import { Providers } from '@/components/wallet/providers';

export default function TelegramMiniAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <Providers>{children}</Providers>
    </>
  );
}
