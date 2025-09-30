import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'zk-SLA | Zero-Knowledge Service Level Proofs',
  description: 'Prove your network performance privately with zero-knowledge proofs',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0B0D10] text-zinc-200 antialiased">
        <Providers>
          <div className="min-h-screen bg-gradient-to-b from-[#0B0D10] to-[#1a1d23]">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}