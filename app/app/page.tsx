'use client';

import Link from 'next/link';
import { Award } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-black/40 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <span className="text-lg font-medium text-white">Divij</span>
            </Link>
            <nav className="flex items-center space-x-6">
              <Link href="/test" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
                Test
              </Link>
              <Link href="/leaderboard" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
                Leaderboard
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative">
        <div className="max-w-6xl mx-auto px-6 py-32">
          {/* Hero Content */}
          <div className="text-center mb-32">
            <h1 className="text-6xl md:text-8xl font-bold leading-tight mb-6 tracking-tight">
              <span className="text-zinc-100">Prove performance</span>
              <br />
              <span className="text-zinc-100">privately</span>
            </h1>

            <p className="text-lg text-zinc-500 max-w-2xl mx-auto mb-12">
              Zero-knowledge proofs for network SLAs
            </p>

            {/* CTA Buttons */}
            <div className="flex items-center justify-center gap-4">
              <Link href="/test">
                <button className="px-8 py-3 bg-zinc-100 text-black text-sm font-medium rounded-lg hover:bg-white transition-colors">
                  Start Test
                </button>
              </Link>

              <Link href="/leaderboard">
                <button className="px-8 py-3 border border-zinc-800 text-zinc-300 text-sm font-medium rounded-lg hover:border-zinc-700 hover:bg-zinc-900/50 transition-colors">
                  Leaderboard
                </button>
              </Link>
            </div>
          </div>

          {/* Performance Tiers */}
          <div>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-zinc-100 mb-3">Performance Tiers</h2>
              <p className="text-sm text-zinc-500">
                28 of 32 samples must meet threshold
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="p-8 rounded-xl bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-colors">
                <div className="w-14 h-14 mx-auto mb-6 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  <Award className="w-7 h-7 text-zinc-400" />
                </div>
                <h3 className="text-xl font-semibold text-zinc-100 mb-2 text-center">Diamond</h3>
                <p className="text-2xl font-bold text-zinc-300 mb-3 text-center">&lt;15ms</p>
                <p className="text-xs text-zinc-500 text-center">Ultra-low latency</p>
              </div>

              <div className="p-8 rounded-xl bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-colors">
                <div className="w-14 h-14 mx-auto mb-6 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  <Award className="w-7 h-7 text-zinc-400" />
                </div>
                <h3 className="text-xl font-semibold text-zinc-100 mb-2 text-center">Gold</h3>
                <p className="text-2xl font-bold text-zinc-300 mb-3 text-center">&lt;50ms</p>
                <p className="text-xs text-zinc-500 text-center">Excellent performance</p>
              </div>

              <div className="p-8 rounded-xl bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-colors">
                <div className="w-14 h-14 mx-auto mb-6 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  <Award className="w-7 h-7 text-zinc-400" />
                </div>
                <h3 className="text-xl font-semibold text-zinc-100 mb-2 text-center">Silver</h3>
                <p className="text-2xl font-bold text-zinc-300 mb-3 text-center">&lt;100ms</p>
                <p className="text-xs text-zinc-500 text-center">Good performance</p>
              </div>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}