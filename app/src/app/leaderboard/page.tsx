'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useReadContract } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CONTRACTS } from '@/lib/web3';
import { Trophy, Award, Users, TrendingUp, Medal, Star } from 'lucide-react';

// Mock leaderboard data for demo
const mockLeaderboardData = [
  { address: '0x1234...5678', tier75: 1, tier150: 2, tier300: 1, totalBadges: 4, rank: 1 },
  { address: '0x2345...6789', tier75: 0, tier150: 3, tier300: 2, totalBadges: 5, rank: 2 },
  { address: '0x3456...789a', tier75: 2, tier150: 1, tier300: 1, totalBadges: 4, rank: 3 },
  { address: '0x4567...89ab', tier75: 1, tier150: 2, tier300: 0, totalBadges: 3, rank: 4 },
  { address: '0x5678...9abc', tier75: 0, tier150: 1, tier300: 2, totalBadges: 3, rank: 5 },
];

const stats = {
  totalHolders: 142,
  totalBadges: 387,
  averagePerformance: 156,
  topPerformer: '0x1234...5678'
};

export default function LeaderboardPage() {
  const [selectedTier, setSelectedTier] = useState<'all' | 75 | 150 | 300>('all');

  const tierOptions = [
    { value: 'all' as const, label: 'All Badges', color: 'text-zinc-300' },
    { value: 75 as const, label: '≤75ms Premium', color: 'text-yellow-400' },
    { value: 150 as const, label: '≤150ms Standard', color: 'text-blue-400' },
    { value: 300 as const, label: '≤300ms Basic', color: 'text-green-400' },
  ];

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Star className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-zinc-400">#{rank}</span>;
    }
  };

  const getTierBadge = (tier: 75 | 150 | 300, count: number) => {
    if (count === 0) return null;

    const colors = {
      75: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      150: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      300: 'bg-green-500/20 text-green-400 border-green-500/30'
    };

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${colors[tier]}`}>
        <Award className="w-3 h-3 mr-1" />
        {count}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#0B0D10] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-r from-indigo-500 via-sky-500 to-teal-400 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Performance Leaderboard</h1>
          <p className="text-lg text-zinc-400">
            Top performers proving their network speed with zero-knowledge
          </p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8"
        >
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-indigo-400 mb-2">{stats.totalHolders}</div>
              <div className="text-sm text-zinc-400">Badge Holders</div>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-sky-400 mb-2">{stats.totalBadges}</div>
              <div className="text-sm text-zinc-400">Total Badges</div>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-teal-400 mb-2">{stats.averagePerformance}ms</div>
              <div className="text-sm text-zinc-400">Avg Performance</div>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-emerald-400 mb-2">
                {stats.topPerformer.slice(0, 8)}...
              </div>
              <div className="text-sm text-zinc-400">Top Performer</div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filter Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-8"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Users className="w-6 h-6" />
                Top Performers
              </CardTitle>
              <CardDescription>
                Ranked by total performance badges earned
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-6">
                {tierOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedTier(option.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      selectedTier === option.value
                        ? 'bg-gradient-to-r from-indigo-500 via-sky-500 to-teal-400 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Leaderboard Table */}
              <div className="space-y-3">
                {mockLeaderboardData.map((user, index) => (
                  <motion.div
                    key={user.address}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 hover:bg-zinc-800/50 ${
                      user.rank <= 3
                        ? 'border-gradient-to-r from-yellow-500/30 to-amber-500/30 bg-gradient-to-r from-yellow-500/5 to-amber-500/5'
                        : 'border-zinc-700 bg-zinc-800/20'
                    }`}
                  >
                    {/* Rank */}
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-800">
                      {getRankIcon(user.rank)}
                    </div>

                    {/* Address */}
                    <div className="flex-1">
                      <div className="font-mono text-lg font-medium">
                        {user.address}
                      </div>
                      <div className="text-sm text-zinc-400">
                        {user.totalBadges} badge{user.totalBadges !== 1 ? 's' : ''} earned
                      </div>
                    </div>

                    {/* Badge Counts */}
                    <div className="flex items-center gap-2">
                      {getTierBadge(75, user.tier75)}
                      {getTierBadge(150, user.tier150)}
                      {getTierBadge(300, user.tier300)}
                    </div>

                    {/* Score */}
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gradient-to-r from-indigo-400 to-teal-400">
                        {user.totalBadges * 100 + user.tier75 * 50 + user.tier150 * 30 + user.tier300 * 10}
                      </div>
                      <div className="text-xs text-zinc-500">Score</div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Load More */}
              <div className="text-center mt-6">
                <button className="text-sm text-zinc-400 hover:text-zinc-300 transition-colors">
                  Load more results...
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Performance Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <Card className="text-center">
            <CardContent className="pt-6">
              <Award className="w-8 h-8 mx-auto mb-3 text-yellow-400" />
              <h3 className="font-semibold mb-2">Premium (≤75ms)</h3>
              <div className="text-2xl font-bold text-yellow-400 mb-1">47</div>
              <p className="text-sm text-zinc-400">High performers</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <Award className="w-8 h-8 mx-auto mb-3 text-blue-400" />
              <h3 className="font-semibold mb-2">Standard (≤150ms)</h3>
              <div className="text-2xl font-bold text-blue-400 mb-1">183</div>
              <p className="text-sm text-zinc-400">Most common tier</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <Award className="w-8 h-8 mx-auto mb-3 text-green-400" />
              <h3 className="font-semibold mb-2">Basic (≤300ms)</h3>
              <div className="text-2xl font-bold text-green-400 mb-1">157</div>
              <p className="text-sm text-zinc-400">Growing segment</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}