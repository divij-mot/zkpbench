'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CONTRACTS } from '@/lib/web3';
import { Award, CheckCircle, ExternalLink, Loader2, AlertCircle, Copy, Twitter } from 'lucide-react';

// ZkSLA1155 ABI (simplified for this function)
const zkSLA1155ABI = [
  {
    name: 'verifyAndMint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'epoch', type: 'uint256' },
      { name: 'T', type: 'uint32' },
      { name: 'm', type: 'uint16' },
      { name: 'n', type: 'uint16' },
      { name: 'root', type: 'bytes32' },
      { name: 'proof', type: 'bytes' },
      { name: 'publicInputs', type: 'uint256[]' }
    ],
    outputs: []
  }
] as const;

interface MintData {
  epoch: number;
  tier: 75 | 150 | 300;
  root: string;
  proof: {
    proof: string;
    publicInputs: string[];
  };
}

export default function MintPage() {
  const { isConnected, address } = useAccount();
  const router = useRouter();

  const [mintData, setMintData] = useState<MintData | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const {
    writeContract,
    data: hash,
    error: writeError,
    isPending: isWritePending
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError
  } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (!isConnected) {
      router.push('/');
      return;
    }

    // Load mint data from localStorage
    const savedMintData = localStorage.getItem('mintData');
    if (!savedMintData) {
      router.push('/prove');
      return;
    }

    try {
      const data: MintData = JSON.parse(savedMintData);
      setMintData(data);
    } catch (error) {
      console.error('Failed to parse mint data:', error);
      router.push('/prove');
    }
  }, [isConnected, router]);

  useEffect(() => {
    if (hash) {
      setTxHash(hash);
    }
  }, [hash]);

  const mintBadge = async () => {
    if (!mintData) return;

    try {
      await writeContract({
        address: CONTRACTS.ZK_SLA_1155,
        abi: zkSLA1155ABI,
        functionName: 'verifyAndMint',
        args: [
          BigInt(mintData.epoch),
          mintData.tier,
          28, // m
          32, // n
          mintData.root as `0x${string}`,
          mintData.proof.proof as `0x${string}`,
          mintData.proof.publicInputs.map(input => BigInt(input))
        ],
      });
    } catch (error) {
      console.error('Failed to mint badge:', error);
    }
  };

  const copyTxHash = () => {
    if (txHash) {
      navigator.clipboard.writeText(txHash);
    }
  };

  const shareOnTwitter = () => {
    if (!mintData) return;

    const text = `Just proved my network performance with zero-knowledge and minted a ${mintData.tier}ms badge on zk-SLA! 🛡️⚡ No logs, no leaks, just verifiable performance. #zkSLA #ZeroKnowledge #DePIN`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const explorerUrl = txHash ? `https://sepolia.basescan.org/tx/${txHash}` : '';

  if (!mintData) {
    return null; // Loading or redirect
  }

  const error = writeError || receiptError;

  return (
    <div className="min-h-screen bg-[#0B0D10] p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-r from-indigo-500 via-sky-500 to-teal-400 flex items-center justify-center mx-auto mb-4">
            <Award className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Mint Performance Badge</h1>
          <p className="text-lg text-zinc-400">
            Submit your proof and mint your on-chain performance badge
          </p>
        </motion.div>

        {/* Mint Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Award className="w-6 h-6" />
                {mintData.tier}ms Performance Badge
              </CardTitle>
              <CardDescription>
                ERC-1155 badge proving you achieved ≤{mintData.tier}ms average RTT
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Badge Preview */}
              <div className="flex items-center justify-center p-8 bg-gradient-to-r from-indigo-500/10 via-sky-500/10 to-teal-400/10 rounded-2xl border border-white/10">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-r from-indigo-500 via-sky-500 to-teal-400 flex items-center justify-center mx-auto mb-4">
                    <Award className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-1">
                    {mintData.tier === 75 ? 'Premium' : mintData.tier === 150 ? 'Standard' : 'Basic'}
                  </h3>
                  <p className="text-sm text-zinc-400">≤{mintData.tier}ms RTT Badge</p>
                  <p className="text-xs text-zinc-500 mt-2">
                    Epoch #{mintData.epoch}
                  </p>
                </div>
              </div>

              {/* Proof Details */}
              <div className="space-y-3 p-4 bg-zinc-800/30 rounded-lg">
                <h4 className="font-medium text-sm text-zinc-300">Proof Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-zinc-400">Epoch</div>
                    <div className="font-mono">#{mintData.epoch}</div>
                  </div>
                  <div>
                    <div className="text-zinc-400">Threshold</div>
                    <div className="font-mono">{mintData.tier}ms</div>
                  </div>
                  <div>
                    <div className="text-zinc-400">Samples</div>
                    <div className="font-mono">28/32</div>
                  </div>
                  <div>
                    <div className="text-zinc-400">Proof Size</div>
                    <div className="font-mono">{Math.floor(mintData.proof.proof.length / 2)} bytes</div>
                  </div>
                </div>
              </div>

              {/* Status and Actions */}
              {!hash && !error && (
                <Button
                  onClick={mintBadge}
                  disabled={isWritePending}
                  size="lg"
                  className="w-full"
                >
                  {isWritePending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting Proof...
                    </>
                  ) : (
                    <>
                      <Award className="w-4 h-4 mr-2" />
                      Mint Badge
                    </>
                  )}
                </Button>
              )}

              {hash && !isConfirmed && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-sky-500/10 border border-sky-500/30 rounded-lg">
                    <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
                    <div>
                      <div className="font-medium text-sky-400">Transaction Submitted</div>
                      <div className="text-sm text-sky-400/80">
                        Waiting for confirmation on Base Sepolia...
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 bg-zinc-800/50 rounded-lg">
                    <span className="text-sm text-zinc-400">Transaction:</span>
                    <code className="flex-1 text-xs font-mono bg-zinc-900 px-2 py-1 rounded">
                      {txHash}
                    </code>
                    <Button size="sm" variant="ghost" onClick={copyTxHash}>
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              {isConfirmed && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                    <div className="flex-1">
                      <div className="font-medium text-emerald-400">Badge Minted Successfully! 🎉</div>
                      <div className="text-sm text-emerald-400/80">
                        Your {mintData.tier}ms performance badge has been minted to your wallet.
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={shareOnTwitter} className="flex-1">
                      <Twitter className="w-4 h-4 mr-2" />
                      Share Achievement
                    </Button>
                    <Button asChild className="flex-1">
                      <a href="/leaderboard">
                        View Leaderboard
                      </a>
                    </Button>
                  </div>

                  {explorerUrl && (
                    <Button variant="ghost" size="sm" className="w-full" asChild>
                      <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View on Block Explorer
                      </a>
                    </Button>
                  )}
                </div>
              )}

              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                  <div>
                    <div className="font-medium text-red-400">Transaction Failed</div>
                    <div className="text-sm text-red-400/80 mt-1">
                      {error.message || 'An error occurred while minting your badge'}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center text-sm text-zinc-400"
        >
          <p>
            Your badge is an ERC-1155 NFT that proves your network performance.
            <br />
            It can be used in DeFi protocols, governance systems, or displayed as a credential.
          </p>
        </motion.div>
      </div>
    </div>
  );
}