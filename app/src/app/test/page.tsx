'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { rttTestService, TestProgress, TestComplete } from '@/lib/websocket-service';
import { Shield, Zap, Clock, Wifi, Loader2, ArrowRight, Award, X } from 'lucide-react';

export default function TestPage() {
  const { isConnected, address } = useAccount();
  const router = useRouter();

  const [isConnecting, setIsConnecting] = useState(false);
  const [testInProgress, setTestInProgress] = useState(false);
  const [testComplete, setTestComplete] = useState(false);
  const [progress, setProgress] = useState<TestProgress>({ completed: 0, total: 32, averageRTT: 0, validSamples: 0 });
  const [testResult, setTestResult] = useState<TestComplete | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dots, setDots] = useState<{ id: number; status: 'pending' | 'success' | 'timeout' }[]>([]);

  useEffect(() => {
    if (!isConnected) {
      router.push('/');
      return;
    }

    // Initialize dots
    setDots(Array.from({ length: 32 }, (_, i) => ({ id: i, status: 'pending' })));
  }, [isConnected, router]);

  useEffect(() => {
    // Update dots based on progress
    if (progress.completed > 0) {
      setDots(prev => prev.map((dot, index) => {
        if (index < progress.completed) {
          return { ...dot, status: Math.random() > 0.1 ? 'success' : 'timeout' };
        }
        return dot;
      }));
    }
  }, [progress.completed]);

  const startTest = async () => {
    if (!address) return;

    setIsConnecting(true);
    setError(null);

    try {
      await rttTestService.startTest(
        address,
        (progressUpdate) => {
          setProgress(progressUpdate);
          setTestInProgress(true);
          setIsConnecting(false);
        },
        (result) => {
          setTestResult(result);
          setTestComplete(true);
          setTestInProgress(false);
        },
        (errorMsg) => {
          setError(errorMsg);
          setIsConnecting(false);
          setTestInProgress(false);
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start test');
      setIsConnecting(false);
    }
  };

  const proceedToProving = () => {
    if (testResult) {
      // Store result in localStorage for the proving page
      localStorage.setItem('testResult', JSON.stringify(testResult));
      router.push('/prove');
    }
  };

  const progressPercentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#0B0D10] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-r from-indigo-500 via-sky-500 to-teal-400 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">RTT Performance Test</h1>
          <p className="text-lg text-zinc-400">
            32 encrypted challenges to measure your network latency
          </p>
        </motion.div>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6"
            >
              <Card className="border-red-500/50 bg-red-500/10">
                <CardContent className="flex items-center gap-3 pt-6">
                  <X className="w-5 h-5 text-red-400" />
                  <span className="text-red-400">{error}</span>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Test Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Wifi className="w-6 h-6" />
                {testComplete ? 'Test Complete!' : testInProgress ? 'Test in Progress' : 'Ready to Start'}
              </CardTitle>
              <CardDescription>
                {testComplete
                  ? 'Your performance has been measured and is ready for proof generation'
                  : testInProgress
                  ? 'Measuring round-trip time to cryptographic challenges...'
                  : 'Click start to begin the RTT measurement test'
                }
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Progress Bar */}
              {(testInProgress || testComplete) && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{progress.completed}/{progress.total} challenges</span>
                  </div>
                  <Progress value={progressPercentage} className="h-3" />
                </div>
              )}

              {/* Dots Visualization */}
              {(testInProgress || testComplete) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-zinc-400">Challenge Status</h4>
                  <div className="grid grid-cols-8 gap-2">
                    {dots.map((dot) => (
                      <motion.div
                        key={dot.id}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
                          dot.status === 'success'
                            ? 'bg-emerald-500 text-white'
                            : dot.status === 'timeout'
                            ? 'bg-red-500 text-white'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: dot.id * 0.05 }}
                      >
                        {dot.id + 1}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats */}
              {(testInProgress || testComplete) && progress.validSamples > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-zinc-800">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-400">
                      {progress.validSamples}
                    </div>
                    <div className="text-xs text-zinc-500">Valid</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-sky-400">
                      {Math.round(progress.averageRTT)}ms
                    </div>
                    <div className="text-xs text-zinc-500">Avg RTT</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-indigo-400">
                      {progress.currentRTT ? `${progress.currentRTT}ms` : '-'}
                    </div>
                    <div className="text-xs text-zinc-500">Last RTT</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-teal-400">
                      {Math.round(progressPercentage)}%
                    </div>
                    <div className="text-xs text-zinc-500">Complete</div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                {!testInProgress && !testComplete && (
                  <Button
                    onClick={startTest}
                    disabled={isConnecting}
                    className="flex-1"
                    size="lg"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Start RTT Test
                      </>
                    )}
                  </Button>
                )}

                {testComplete && testResult && (
                  <Button
                    onClick={proceedToProving}
                    className="flex-1"
                    size="lg"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Generate Proof
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>

              {/* Tier Preview */}
              {testResult && (
                <div className="pt-4 border-t border-zinc-800">
                  <h4 className="text-sm font-medium text-zinc-400 mb-3">Eligible Tiers</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(testResult.eligibleTiers).map(([tier, eligible]) => (
                      <div
                        key={tier}
                        className={`p-3 rounded-xl border text-center ${
                          eligible
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                            : 'border-zinc-700 bg-zinc-800/50 text-zinc-500'
                        }`}
                      >
                        <Award className="w-4 h-4 mx-auto mb-1" />
                        <div className="text-xs font-medium">
                          ≤{tier.replace('tier', '')}ms
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Info Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <Card className="text-center">
            <CardContent className="pt-6">
              <Shield className="w-8 h-8 mx-auto mb-3 text-indigo-400" />
              <h3 className="font-semibold mb-2">Privacy First</h3>
              <p className="text-sm text-zinc-400">
                Your raw RTT data never leaves your device. Only ZK proofs are shared.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <Clock className="w-8 h-8 mx-auto mb-3 text-sky-400" />
              <h3 className="font-semibold mb-2">Real-Time</h3>
              <p className="text-sm text-zinc-400">
                Live measurement with anti-replay protection using cryptographic nonces.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <Award className="w-8 h-8 mx-auto mb-3 text-teal-400" />
              <h3 className="font-semibold mb-2">Verifiable</h3>
              <p className="text-sm text-zinc-400">
                Proofs are verified on-chain before minting performance badges.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}