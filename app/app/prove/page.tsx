'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { generateZKProof, selectOptimalSamples, formatProofForContract } from '@/lib/zk-proving';

interface TestResults {
  sessionId: string;
  epoch: number;
  results: Array<{
    index: number;
    rttMs: number;
    valid: boolean;
  }>;
  bestTier: number;
  flowToken?: string;
  timestamp?: number;
}

export default function ProvePage() {
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [selectedTier, setSelectedTier] = useState<15 | 50 | 100 | null>(null);
  const [isProving, setIsProving] = useState(false);
  const [provingProgress, setProvingProgress] = useState(0);
  const [proof, setProof] = useState<any>(null);
  const [error, setError] = useState<string>('');

  // Load test results from localStorage
  useEffect(() => {
    const savedResults = localStorage.getItem('testResult');
    if (savedResults) {
      const parsed = JSON.parse(savedResults);
      
      // Security: Check if test is fresh (within 30 minutes)
      const testAge = Date.now() - (parsed.timestamp || 0);
      const maxAge = 30 * 60 * 1000; // 30 minutes for development
      
      if (testAge > maxAge) {
        console.warn('Test results expired. Please run a new test.');
        localStorage.removeItem('testResult');
        localStorage.removeItem('zkProof');
        return;
      }
      
      setTestResults(parsed);

      // Auto-select the best achievable tier
      if (parsed.bestTier > 0) {
        setSelectedTier(parsed.bestTier);
      }
    }
  }, []);

  const getTierConfig = (threshold: number) => {
    switch (threshold) {
      case 15:
        return {
          name: 'Diamond',
          color: 'from-blue-400 to-purple-500',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/20',
          textColor: 'text-blue-300'
        };
      case 50:
        return {
          name: 'Gold',
          color: 'from-yellow-400 to-orange-500',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/20',
          textColor: 'text-yellow-300'
        };
      case 100:
        return {
          name: 'Silver',
          color: 'from-gray-400 to-gray-600',
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-500/20',
          textColor: 'text-gray-300'
        };
      default:
        return {
          name: 'Unknown',
          color: 'from-gray-400 to-gray-600',
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-500/20',
          textColor: 'text-gray-300'
        };
    }
  };

  const canProveFor = (threshold: number) => {
    if (!testResults) return false;
    const validSamples = testResults.results.filter(r => r.valid);
    
    if (validSamples.length < 28) return false;
    
    // Get the best 28 samples and check if the worst one meets the threshold
    const sortedRtts = validSamples.map(s => s.rttMs).sort((a, b) => a - b);
    const best28 = sortedRtts.slice(0, 28);
    const worstOfBest28 = best28[best28.length - 1];
    
    return worstOfBest28 <= threshold;
  };

  const generateProof = async () => {
    if (!testResults || !selectedTier) return;

    setIsProving(true);
    setError('');
    setProvingProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProvingProgress(prev => Math.min(prev + 2, 95));
      }, 300);

      // Fetch the real Merkle root from blockchain for this epoch
      let merkleRoot: string | null = null;
      
      console.log(`Fetching Merkle root for epoch ${testResults.epoch}...`);
      
      // Try up to 3 times with increasing delays
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const rootResponse = await fetch(`/api/get-epoch-root?epoch=${testResults.epoch}`);
          if (rootResponse.ok) {
            const rootData = await rootResponse.json();
            if (rootData.isFinalized && rootData.merkleRoot) {
              merkleRoot = rootData.merkleRoot;
              console.log(`✅ Using on-chain Merkle root: ${merkleRoot}`);
              break;
            } else {
              console.warn(`⚠️  Epoch ${testResults.epoch} not finalized yet (attempt ${attempt + 1}/3)`);
              if (attempt < 2) {
                // Wait before retrying (2s, then 5s)
                await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 2000 : 5000));
              }
            }
          }
        } catch (err) {
          console.error('Error fetching epoch root:', err);
        }
      }
      
      // If still no root after retries, show error
      if (!merkleRoot) {
        clearInterval(progressInterval);
        setIsProving(false);
        setError(`Epoch ${testResults.epoch} is not finalized on-chain yet. Please wait a moment and try again. The backend may still be processing your test results.`);
        return;
      }

      // Validate user actually qualifies for selected tier
      if (!canProveFor(selectedTier)) {
        clearInterval(progressInterval);
        setIsProving(false);
        setError(`You don't qualify for ${getTierConfig(selectedTier).name} tier. The worst of your best 28 samples must be ≤${selectedTier}ms.`);
        return;
      }

      // Get optimal samples for the selected tier
      const { indices, rtts } = selectOptimalSamples(testResults.results, selectedTier, 28);
      
      // Calculate the actual worst RTT among the best 28 (this is the actual achieved latency)
      const actualRtt = Math.max(...rtts);
      
      // CRITICAL: Verify the worst RTT actually meets the threshold
      if (actualRtt > selectedTier) {
        clearInterval(progressInterval);
        setIsProving(false);
        setError(`Validation failed: Your worst RTT (${actualRtt}ms) exceeds the ${getTierConfig(selectedTier).name} threshold (${selectedTier}ms)`);
        return;
      }
      
      console.log(`✅ Actual best RTT achieved: ${actualRtt}ms (threshold: ${selectedTier}ms)`);

      // Generate ZK proof
      const zkProof = await generateZKProof({
        root: merkleRoot,
        threshold: selectedTier,
        m: 28,
        n: 32,
        indices,
        rtts
      });

      clearInterval(progressInterval);
      setProvingProgress(100);

      // Format for contract
      const contractProof = formatProofForContract(zkProof);
      setProof({
        ...contractProof,
        tier: selectedTier,
        epoch: testResults.epoch,
        root: merkleRoot
      });

      // Save proof to localStorage for mint page with security token
      localStorage.setItem('zkProof', JSON.stringify({
        ...contractProof,
        tier: selectedTier,
        epoch: testResults.epoch,
        root: merkleRoot,
        actualRtt, // Include the actual best RTT achieved
        flowToken: testResults.flowToken, // Bind to original test
        proofTimestamp: Date.now() // Add timestamp
      }));

    } catch (err) {
      console.error('Proving failed:', err);
      setError(err instanceof Error ? err.message : 'Proof generation failed');
      setProvingProgress(0);
    } finally {
      setIsProving(false);
    }
  };

  if (!testResults) {
    return (
      <div className="min-h-screen bg-[#0B0D10] flex items-center justify-center">
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <h2 className="text-2xl font-semibold text-white">No Test Results</h2>
            <p className="text-zinc-400">You need to complete a performance test first.</p>
            <Link href="/test">
              <Button className="bg-zinc-900 text-zinc-100 hover:bg-zinc-800 border border-zinc-800">
                Run Performance Test
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0D10]">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 via-sky-500 to-teal-400 rounded-lg"></div>
              <span className="text-xl font-semibold text-white">Divij</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-4xl">
        <div className="space-y-8">

          {/* Title */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold text-white">
              Generate ZK Proof
            </h1>
            <p className="text-xl text-zinc-400">
              Prove your performance achievement without revealing raw data
            </p>
          </div>

          {/* Test Summary */}
          <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Test Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{testResults.results.filter(r => r.valid).length}</div>
                  <div className="text-sm text-zinc-400">Valid samples</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{testResults.epoch}</div>
                  <div className="text-sm text-zinc-400">Epoch</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {Math.round(testResults.results.filter(r => r.valid).reduce((sum, r) => sum + r.rttMs, 0) / testResults.results.filter(r => r.valid).length) || 0}ms
                  </div>
                  <div className="text-sm text-zinc-400">Avg RTT</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {(() => {
                      const validSamples = testResults.results.filter(r => r.valid);
                      if (validSamples.length < 28) return 'N/A';
                      const sortedRtts = validSamples.map(s => s.rttMs).sort((a, b) => a - b);
                      return sortedRtts[27] + 'ms';
                    })()}
                  </div>
                  <div className="text-sm text-zinc-400">Worst of Best 28</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {testResults.bestTier ? getTierConfig(testResults.bestTier).name : 'None'}
                  </div>
                  <div className="text-sm text-zinc-400">Best Qualified</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tier Selection */}
          <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Select Tier to Prove</h3>

              <div className="grid md:grid-cols-3 gap-4">
                {[15, 50, 100].map((threshold) => {
                  const tierConfig = getTierConfig(threshold);
                  const canProve = canProveFor(threshold);
                  const isSelected = selectedTier === threshold;

                  return (
                    <button
                      key={threshold}
                      onClick={() => setSelectedTier(threshold as 15 | 50 | 100)}
                      disabled={!canProve}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? `${tierConfig.bgColor} ${tierConfig.borderColor} scale-105 shadow-lg`
                          : canProve
                          ? `bg-white/5 border-white/10 hover:${tierConfig.bgColor} hover:${tierConfig.borderColor} hover:scale-102`
                          : 'bg-white/5 border-white/5 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className={`w-12 h-12 mx-auto mb-3 bg-gradient-to-r ${tierConfig.color} rounded-full flex items-center justify-center`}>
                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M5 16L3 5h5.5l1 5 1-5H16l-2 11H5z"/>
                        </svg>
                      </div>
                      <h4 className={`font-semibold mb-2 ${canProve ? 'text-white' : 'text-zinc-500'}`}>
                        {tierConfig.name}
                      </h4>
                      <p className={`text-sm mb-2 ${canProve ? tierConfig.textColor : 'text-zinc-500'}`}>
                        ≤ {threshold}ms
                      </p>
                      <p className={`text-xs ${canProve ? 'text-green-400' : 'text-red-400'}`}>
                        {canProve ? '✓ Qualified' : '✗ Not qualified'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Proof Generation */}
          {selectedTier && (
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-6">Zero-Knowledge Proof</h3>

                {!isProving && !proof && (
                  <div className="text-center space-y-4">
                    <p className="text-zinc-400">
                      Generate a zero-knowledge proof that you achieved {getTierConfig(selectedTier).name} tier performance
                    </p>
                    <Button
                      onClick={generateProof}
                      size="lg"
                      className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-8 py-4"
                    >
                      Generate Proof
                    </Button>
                  </div>
                )}

                {isProving && (
                  <div className="text-center space-y-4">
                    <div className="text-xl font-semibold text-white mb-4">
                      Generating Proof...
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-3 mb-4">
                      <div
                        className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${provingProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-zinc-400">
                      This takes 15-25 seconds using zero-knowledge cryptography
                    </p>
                  </div>
                )}

                {error && (
                  <div className="text-center space-y-4">
                    <div className="text-red-400 font-semibold">
                      ❌ Proof Generation Failed
                    </div>
                    <p className="text-sm text-zinc-400">{error}</p>
                    <Button
                      onClick={generateProof}
                      variant="outline"
                      className="border-white/20 text-zinc-300"
                    >
                      Try Again
                    </Button>
                  </div>
                )}

                {proof && (
                  <div className="text-center space-y-6">
                    <div className="text-green-400 text-xl font-semibold">
                      ✓ Proof Generated Successfully!
                    </div>

                    {/* Proof Details */}
                    <div className="bg-black/20 rounded-lg p-4 text-left">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-zinc-400">Tier</div>
                          <div className="text-white font-mono">{getTierConfig(proof.tier).name}</div>
                        </div>
                        <div>
                          <div className="text-zinc-400">Threshold</div>
                          <div className="text-white font-mono">≤{proof.tier}ms</div>
                        </div>
                        <div>
                          <div className="text-zinc-400">Epoch</div>
                          <div className="text-white font-mono">{proof.epoch}</div>
                        </div>
                        <div>
                          <div className="text-zinc-400">Proof Size</div>
                          <div className="text-white font-mono">{proof.proof.length / 2} bytes</div>
                        </div>
                      </div>
                    </div>

                    <Link href="/mint">
                      <Button size="lg" className="bg-zinc-100 text-black hover:bg-white px-8 py-4">
                        Submit & Mint Badge →
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}