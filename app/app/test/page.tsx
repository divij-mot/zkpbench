'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Play, Zap, Activity, Award, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface TestSession {
  sessionId: string;
  epoch: number;
  challengeCount: number;
  estimatedDuration: number;
  firstChallengeAt: number;
}

interface Challenge {
  index: number;
  nonce: string;
  timestamp: number;
  deadline: number;
}

interface RTTResult {
  challengeIndex: number;
  rttMs: number;
  valid: boolean;
  completedChallenges: number;
  totalChallenges: number;
  isComplete: boolean;
}

export default function TestPage() {
  const [session, setSession] = useState<TestSession | null>(null);
  const [currentChallenge, setCurrentChallenge] = useState<Challenge | null>(null);
  const [results, setResults] = useState<RTTResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [progress, setProgress] = useState(0);
  const [avgRtt, setAvgRtt] = useState(0);

  // Auto-save test results when test completes
  useEffect(() => {
    if (isComplete && results.length > 0 && session) {
      saveTestResults(session.sessionId, session.epoch);
    }
  }, [isComplete, results.length]);

  // Start test session
  const startTest = async () => {
    try {
      setIsRunning(true);

      const response = await fetch('/api/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: '0x' + Math.random().toString(16).slice(2) })
      });

      if (!response.ok) {
        throw new Error('Failed to start session');
      }

      const sessionData: TestSession = await response.json();
      setSession(sessionData);

      // Start challenge loop
      startChallengeLoop(sessionData.sessionId);
    } catch (error) {
      console.error('Failed to start test:', error);
      setIsRunning(false);
    }
  };

  // Challenge loop
  const startChallengeLoop = async (sessionId: string) => {
    const interval = setInterval(async () => {
      try {
        // Check for current challenge
        const statusResponse = await fetch(`/api/start-session?sessionId=${sessionId}`);
        const status = await statusResponse.json();

        if (status.currentChallenge) {
          setCurrentChallenge(status.currentChallenge);

          // Send ping
          const sentAt = Date.now();
          const pingResponse = await fetch('/api/rtt-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              nonce: status.currentChallenge.nonce,
              sentAt
            })
          });

          const result: RTTResult = await pingResponse.json();
          setResults(prev => [...prev, result]);
          setProgress((result.completedChallenges / result.totalChallenges) * 100);

          // Update average RTT
          if (result.valid && results.length > 0) {
            const validResults = results.filter(r => r.valid);
            const sum = validResults.reduce((acc, r) => acc + r.rttMs, 0);
            setAvgRtt(Math.round(sum / validResults.length));
          }

          // Check if complete
          if (result.isComplete) {
            setIsComplete(true);
            setIsRunning(false);
            clearInterval(interval);
            // Results will be saved by useEffect
          }
        }
      } catch (error) {
        console.error('Challenge error:', error);
      }
    }, 1400); // Every 1.4s as specified

    // Auto-stop after reasonable time
    setTimeout(() => {
      clearInterval(interval);
      setIsRunning(false);
      setIsComplete(true);
      // Results will be saved by useEffect when isComplete changes
    }, 60000); // 60 seconds max
  };
  
  // Helper function to save test results
  const saveTestResults = (sessId: string, epoch: number) => {
    // Don't save if no results yet
    if (results.length === 0) {
      console.warn('No results to save yet');
      return;
    }
    setTimeout(() => {
      const validResults = results.filter(r => r.valid);
      
      // Calculate best tier (updated thresholds)
      let bestTier = 100;
      if (validResults.length >= 28) {
        const rtts = validResults.map(r => r.rttMs).sort((a, b) => a - b);
        const best28 = rtts.slice(0, 28);
        const worstOfBest28 = best28[best28.length - 1];
        
        if (worstOfBest28 < 15) bestTier = 15;
        else if (worstOfBest28 < 50) bestTier = 50;
        else if (worstOfBest28 < 100) bestTier = 100;
      }
      
      const testResults = {
        sessionId: sessId,
        epoch: epoch,
        results: results.map(r => ({
          index: r.challengeIndex,
          rttMs: r.rttMs,
          valid: r.valid
        })),
        bestTier,
        timestamp: Date.now(), // Add timestamp for freshness check
        flowToken: crypto.randomUUID() // Unique token to track flow progression
      };
      localStorage.setItem('testResult', JSON.stringify(testResults));
      
      // Clear any old proof data - force user to generate new proof
      localStorage.removeItem('zkProof');
      
      console.log('✅ Test results saved to localStorage:', testResults);
    }, 100);
  };

  // Calculate potential tier
  const getPotentialTier = () => {
    const validResults = results.filter(r => r.valid);
    if (validResults.length < 28) return null;

    const rtts = validResults.map(r => r.rttMs).sort((a, b) => a - b);
    const best28 = rtts.slice(0, 28);
    const worstOfBest28 = best28[best28.length - 1];

    if (worstOfBest28 < 15) return { tier: 'Diamond', threshold: 15 };
    if (worstOfBest28 < 50) return { tier: 'Gold', threshold: 50 };
    if (worstOfBest28 < 100) return { tier: 'Silver', threshold: 100 };
    return null;
  };

  const potentialTier = getPotentialTier();

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
              <Link href="/test" className="text-sm text-zinc-200">
                Test
              </Link>
              <Link href="/leaderboard" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
                Leaderboard
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="relative">
        <div className="max-w-4xl mx-auto px-6 py-20">
          {/* Header Section */}
          <div className="text-center mb-12">
            <div className="w-12 h-12 mx-auto mb-6 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Activity className="w-6 h-6 text-zinc-400" />
            </div>
            <h1 className="text-4xl font-bold text-zinc-100 mb-3">
              Network Performance Test
            </h1>
            <p className="text-sm text-zinc-500">
              Run 32 RTT challenges over 45 seconds to measure your network performance
            </p>
          </div>

          {/* Test Controls */}
          {!isRunning && !isComplete && (
            <div className="text-center mb-12">
              <button
                onClick={startTest}
                className="inline-flex items-center space-x-2 px-8 py-3 bg-zinc-900 text-zinc-100 text-sm font-medium rounded-lg hover:bg-zinc-800 border border-zinc-800 transition-colors"
              >
                <Play className="w-4 h-4" />
                <span>Start Performance Test</span>
              </button>
            </div>
          )}

          {/* Progress Card */}
          {(isRunning || isComplete) && (
            <div className="rounded-xl bg-zinc-950 border border-zinc-900 p-8 mb-8">
              <div className="space-y-6">
                {/* Progress Bar */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium text-zinc-100">Test Progress</h3>
                    <span className="text-xs text-zinc-400">{results.length}/32 challenges</span>
                  </div>
                  <div className="w-full bg-zinc-900 rounded-full h-2">
                    <div
                      className="bg-zinc-100 h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
                    <div className="text-2xl font-bold text-zinc-100 mb-1">
                      {results.filter(r => r.valid).length}
                    </div>
                    <div className="text-xs text-zinc-500">Valid Samples</div>
                  </div>

                  <div className="text-center p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
                    <div className="text-2xl font-bold text-zinc-100 mb-1">
                      {avgRtt || '--'}ms
                    </div>
                    <div className="text-xs text-zinc-500">Avg RTT</div>
                  </div>

                  <div className="text-center p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
                    <div className="text-2xl font-bold text-zinc-100 mb-1">
                      {currentChallenge?.index !== undefined ? currentChallenge.index + 1 : '--'}
                    </div>
                    <div className="text-xs text-zinc-500">Current</div>
                  </div>

                  <div className="text-center p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
                    <div className="text-2xl font-bold text-zinc-100 mb-1">
                      {session?.epoch || '--'}
                    </div>
                    <div className="text-xs text-zinc-500">Epoch</div>
                  </div>
                </div>

                {/* Status */}
                <div className="text-center p-6 rounded-lg bg-zinc-900/30 border border-zinc-800">
                  {isRunning && (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-zinc-400"></div>
                      <span className="text-sm font-medium text-zinc-300">
                        Running test...
                      </span>
                    </div>
                  )}
                  {isComplete && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center space-x-2">
                        <Award className="w-5 h-5 text-zinc-400" />
                        <span className="text-lg font-semibold text-zinc-100">
                          Test Complete!
                        </span>
                      </div>
                      {potentialTier && (
                        <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
                          <div className="text-xs text-zinc-500 mb-1">Potential Badge</div>
                          <div className="text-2xl font-bold text-zinc-100 mb-1">
                            {potentialTier.tier}
                          </div>
                          <div className="text-sm text-zinc-400">≤ {potentialTier.threshold}ms</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Next Steps */}
          {isComplete && (
            <div className="text-center">
              <Link
                href="/prove"
                className="inline-flex items-center space-x-2 px-8 py-3 bg-zinc-100 text-black text-sm font-medium rounded-lg hover:bg-white transition-colors"
              >
                <Zap className="w-4 h-4" />
                <span>Generate ZK Proof</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}