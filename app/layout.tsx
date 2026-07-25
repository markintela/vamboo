import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './Providers';

export const metadata: Metadata = {
  title: 'Vamboo — roteiro, despesas e hospedagem',
  description: 'Organize o roteiro, as despesas e a hospedagem das suas viagens.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#2f9be0',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
