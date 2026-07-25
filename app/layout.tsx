import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vamboo — roteiro, despesas e hospedagem',
  description: 'Organize o roteiro, as despesas e a hospedagem das suas viagens.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
