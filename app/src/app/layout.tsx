import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Web3Provider } from "@/components/providers/web3-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "zk-SLA | Zero-Knowledge Service-Level Proofs",
  description: "Prove your network performance privately with zero-knowledge proofs and mint on-chain badges.",
  keywords: ["zero-knowledge", "blockchain", "SLA", "privacy", "DePIN"],
  openGraph: {
    title: "zk-SLA | Zero-Knowledge Service-Level Proofs",
    description: "Prove your network performance privately with zero-knowledge proofs and mint on-chain badges.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-[#0B0D10] text-zinc-200 min-h-screen`}>
        <Web3Provider>
          {children}
        </Web3Provider>
      </body>
    </html>
  );
}
