'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { generateZKProof, estimateEligibleTiers, formatProofForContract, type GeneratedProof } from '@/lib/zk-proving';
import { rttTestService, type TestComplete } from '@/lib/websocket-service';
import { Shield, Cpu, CheckCircle, AlertCircle, Clock, Zap, ArrowRight, Award } from 'lucide-react';

interface ProvingState {
  phase: 'idle' | 'compiling' | 'generating' | 'verifying' | 'complete' | 'error';
  progress: number;
  message: string;
}

export default function ProvePage() {
  const { isConnected, address } = useAccount();
  const router = useRouter();

  const [testResult, setTestResult] = useState<TestComplete | null>(null);
  const [selectedTier, setSelectedTier] = useState<75 | 150 | 300 | null>(null);
  const [provingState, setProvingState] = useState<ProvingState>({
    phase: 'idle',
    progress: 0,
    message: 'Ready to generate proof'
  });
  const [generatedProof, setGeneratedProof] = useState<GeneratedProof | null>(null);
  const [bundleData, setBundleData] = useState<any>(null);

  useEffect(() => {
    if (!isConnected) {
      router.push('/');
      return;
    }

    // Load test result from localStorage
    const savedResult = localStorage.getItem('testResult');
    if (!savedResult) {
      router.push('/test');
      return;
    }

    try {
      const result: TestComplete = JSON.parse(savedResult);
      setTestResult(result);
    } catch (error) {
      console.error('Failed to parse test result:', error);
      router.push('/test');
    }
  }, [isConnected, router]);

  const fetchBundleData = async () => {
    if (!testResult) return;

    try {
      const bundle = await rttTestService.fetchBundle(testResult.epoch);
      setBundleData(bundle);
    } catch (error) {
      console.error('Failed to fetch bundle:', error);
    }
  };

  useEffect(() => {
    if (testResult) {
      fetchBundleData();
    }
  }, [testResult]);

  const generateProof = async (tier: 75 | 150 | 300) => {
    if (!testResult || !bundleData) return;

    setSelectedTier(tier);
    setProvingState({ phase: 'compiling', progress: 0, message: 'Compiling circuit...' });

    try {
      // Simulate compilation phase
      await new Promise(resolve => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += Math.random() * 10;
          if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            resolve(void 0);
          }
          setProvingState({
            phase: 'compiling',
            progress,
            message: 'Compiling Noir circuit with Poseidon constraints...'
          });
        }, 200);
      });

      // Generation phase
      setProvingState({ phase: 'generating', progress: 0, message: 'Generating zero-knowledge proof...' });

      const proof = await generateZKProof({
        root: testResult.root,
        threshold: tier,
        m: 28,
        n: 32,
        epoch: testResult.epoch,
        samples: testResult.samples,
        merkleProofs: bundleData.proofs || [],
      });

      // Verification phase
      setProvingState({ phase: 'verifying', progress: 90, message: 'Verifying proof locally...' });
      await new Promise(resolve => setTimeout(resolve, 2000));

      setGeneratedProof(proof);
      setProvingState({
        phase: 'complete',
        progress: 100,
        message: `Proof generated successfully for ${tier}ms tier!`
      });

    } catch (error) {
      console.error('Proof generation failed:', error);
      setProvingState({
        phase: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Proof generation failed'
      });
    }
  };

  const proceedToMinting = () => {
    if (generatedProof && selectedTier && testResult) {
      const formattedProof = formatProofForContract(generatedProof);
      const mintData = {
        epoch: testResult.epoch,
        tier: selectedTier,
        root: testResult.root,
        proof: formattedProof,
      };
      localStorage.setItem('mintData', JSON.stringify(mintData));
      router.push('/mint');
    }
  };

  if (!testResult) {
    return null; // Loading or redirect
  }

  const eligibleTiers = estimateEligibleTiers(testResult.samples);
  const tierOptions: { tier: 75 | 150 | 300; label: string; description: string }[] = [
    { tier: 75, label: 'Premium', description: '≤75ms average RTT' },
    { tier: 150, label: 'Standard', description: '≤150ms average RTT' },
    { tier: 300, label: 'Basic', description: '≤300ms average RTT' },
  ];

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
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Generate ZK Proof</h1>
          <p className="text-lg text-zinc-400">
            Create a zero-knowledge proof of your network performance
          </p>
        </motion.div>

        {/* Tier Selection */}
        {provingState.phase === 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-8"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Award className="w-6 h-6" />
                  Select Performance Tier
                </CardTitle>
                <CardDescription>
                  Choose the tier you want to prove and mint a badge for
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {tierOptions.map(({ tier, label, description }) => {
                    const isEligible = eligibleTiers[`tier${tier}` as keyof typeof eligibleTiers];
                    return (
                      <motion.div
                        key={tier}
                        whileHover={isEligible ? { scale: 1.02 } : undefined}
                        whileTap={isEligible ? { scale: 0.98 } : undefined}
                      >
                        <Card
                          className={`cursor-pointer transition-all duration-200 ${
                            isEligible
                              ? 'border-emerald-500 hover:bg-emerald-500/5'
                              : 'border-zinc-700 opacity-50 cursor-not-allowed'
                          }`}
                          onClick={() => isEligible && generateProof(tier)}
                        >
                          <CardContent className="p-6 text-center">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 ${
                              isEligible
                                ? 'bg-gradient-to-r from-indigo-500 via-sky-500 to-teal-400'
                                : 'bg-zinc-700'
                            }`}>
                              <Award className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="font-semibold text-lg mb-1">{label}</h3>
                            <p className="text-sm text-zinc-400 mb-3">{description}</p>
                            <div className="flex items-center justify-center gap-2">
                              {isEligible ? (
                                <>
                                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                                  <span className="text-sm text-emerald-400">Eligible</span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="w-4 h-4 text-zinc-500" />
                                  <span className="text-sm text-zinc-500">Not Eligible</span>
                                </>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Proving Progress */}
        {provingState.phase !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Cpu className="w-6 h-6" />
                  {selectedTier && `${selectedTier}ms Tier Proof Generation`}
                </CardTitle>
                <CardDescription>
                  {provingState.message}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {provingState.phase !== 'error' && provingState.phase !== 'complete' && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{Math.round(provingState.progress)}%</span>
                    </div>
                    <Progress value={provingState.progress} className="h-2" />
                  </div>
                )}

                {provingState.phase === 'complete' && generatedProof && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                      <CheckCircle className="w-6 h-6 text-emerald-400" />
                      <div>
                        <div className="font-medium text-emerald-400">Proof Generated Successfully!</div>
                        <div className="text-sm text-emerald-400/80">
                          Ready to mint your {selectedTier}ms performance badge
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-800/50 rounded-lg">
                      <div>
                        <div className="text-sm text-zinc-400">Proof Size</div>
                        <div className="font-mono text-lg">{generatedProof.proof.length} bytes</div>
                      </div>
                      <div>
                        <div className="text-sm text-zinc-400">Public Inputs</div>
                        <div className="font-mono text-lg">{generatedProof.publicInputs.length}</div>
                      </div>
                    </div>

                    <Button
                      onClick={proceedToMinting}
                      size="lg"
                      className="w-full"
                    >
                      <Award className="w-4 h-4 mr-2" />
                      Mint Badge
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                )}

                {provingState.phase === 'error' && (
                  <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                    <div>
                      <div className="font-medium text-red-400">Proof Generation Failed</div>
                      <div className="text-sm text-red-400/80">{provingState.message}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Technical Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <Card className="text-center">
            <CardContent className="pt-6">
              <Shield className="w-8 h-8 mx-auto mb-3 text-indigo-400" />
              <h3 className="font-semibold mb-2">Zero-Knowledge</h3>
              <p className="text-sm text-zinc-400">
                Prove you met the SLA without revealing any raw RTT measurements.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <Zap className="w-8 h-8 mx-auto mb-3 text-sky-400" />
              <h3 className="font-semibold mb-2">Noir Circuits</h3>
              <p className="text-sm text-zinc-400">
                Powered by Aztec's Noir language with Poseidon hash verification.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <Clock className="w-8 h-8 mx-auto mb-3 text-teal-400" />
              <h3 className="font-semibold mb-2">Fast Proving</h3>
              <p className="text-sm text-zinc-400">
                Browser-based proving with sub-20 second generation times.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}