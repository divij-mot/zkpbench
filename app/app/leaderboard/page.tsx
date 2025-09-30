'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Award } from 'lucide-react';

interface BadgeHolder {
  address: string;
  tier: 'Diamond' | 'Gold' | 'Silver';
  threshold: number;
  actualRtt: number; // The actual RTT achieved
  timestamp: number;
}

export default function LeaderboardPage() {
  const [holders, setHolders] = useState<BadgeHolder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBadgeHolders();
  }, []);

  const loadBadgeHolders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/leaderboard');
      const data = await response.json();
      
      if (data.leaderboard && Array.isArray(data.leaderboard)) {
        setHolders(data.leaderboard);
        console.log(`✅ Loaded ${data.leaderboard.length} leaderboard entries`);
      } else {
        setHolders([]);
      }
    } catch (error) {
      console.error('Failed to load badge holders:', error);
      setHolders([]);
    } finally {
      setLoading(false);
    }
  };

  const getTierIcon = (tier: string) => {
    const colors: Record<string, string> = {
      'Diamond': 'text-blue-400',
      'Gold': 'text-yellow-400',
      'Silver': 'text-gray-400'
    };
    return <Award className={`w-5 h-5 ${colors[tier] || 'text-zinc-400'}`} />;
  };

  const getThreshold = (tier: string) => {
    switch (tier) {
      case 'Diamond': return '<15ms';
      case 'Gold': return '<50ms';
      case 'Silver': return '<100ms';
      default: return '';
    }
  };

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
              <Link href="/leaderboard" className="text-sm text-zinc-200">
                Leaderboard
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-20">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-zinc-100 mb-2">Leaderboard</h1>
          <p className="text-sm text-zinc-500">Verified performance badges</p>
                </div>
                
            {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin mb-4"></div>
            <p className="text-sm text-zinc-500">Loading...</p>
              </div>
            ) : holders.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-6 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Award className="w-8 h-8 text-zinc-600" />
            </div>
            <h3 className="text-xl font-semibold text-zinc-200 mb-2">No badges yet</h3>
            <p className="text-sm text-zinc-500 mb-8">Be the first to earn a performance badge</p>
            <Link
              href="/test"
              className="inline-block px-6 py-2 bg-zinc-100 text-black text-sm font-medium rounded-lg hover:bg-white transition-colors"
            >
              Start Test
            </Link>
          </div>
        ) : (
          <div className="border border-zinc-900 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-950">
                  <th className="text-left px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Rank</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Badge</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Address</th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Latency</th>
                </tr>
              </thead>
              <tbody>
                {holders.map((holder, index) => (
                  <tr
                    key={index}
                    className="border-b border-zinc-900 last:border-0 hover:bg-zinc-950/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800">
                        <span className="text-xs font-bold text-zinc-400">#{index + 1}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        {getTierIcon(holder.tier)}
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-zinc-300">{holder.tier}</span>
                          <span className="text-xs text-zinc-600">{getThreshold(holder.tier)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-zinc-400 font-mono">
                        {holder.address.slice(0, 6)}...{holder.address.slice(-4)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-bold text-zinc-100">
                          {holder.actualRtt}ms
                        </span>
                        <span className="text-xs text-zinc-600">actual</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
        )}
      </main>
    </div>
  );
}