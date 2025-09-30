'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, Award, AlertCircle } from 'lucide-react';
import { CONTRACTS, ZK_SLA_1155_ABI, CHAIN_CONFIG } from '@/lib/contracts';
import { parseEther, hexToBigInt } from 'viem';

interface ProofData {
  proof: string;
  publicInputs: string[];
  tier: number;
  epoch: number;
  root: string;
  actualRtt: number; // The actual best RTT achieved
}

export default function MintPage() {
  const [proofData, setProofData] = useState<ProofData | null>(null);
  const [error, setError] = useState<string>('');
  const [isMinting, setIsMinting] = useState(false);
  
  const { address, isConnected } = useAccount();
  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    // Security: Load and validate proof from localStorage
    const savedProof = localStorage.getItem('zkProof');
    const savedTest = localStorage.getItem('testResult');
    
    if (!savedProof || !savedTest) {
      return;
    }
    
    try {
      const parsedProof = JSON.parse(savedProof);
      const parsedTest = JSON.parse(savedTest);
      
      // Security Check 1: Validate proof structure
      if (!parsedProof.proof || !parsedProof.publicInputs || !parsedProof.tier || !parsedProof.epoch || !parsedProof.root) {
        console.error('Invalid proof data structure');
        localStorage.removeItem('zkProof');
        return;
      }
      
      // Security Check 2: Validate flow token matches (prevents using old test with new proof)
      if (parsedProof.flowToken !== parsedTest.flowToken) {
        console.error('Flow token mismatch - proof does not match test results');
        setError('Security validation failed. Please run a new test.');
        localStorage.removeItem('zkProof');
        localStorage.removeItem('testResult');
        return;
      }
      
      // Security Check 3: Validate proof is fresh (within 30 minutes of generation)
      const proofAge = Date.now() - (parsedProof.proofTimestamp || 0);
      const maxProofAge = 30 * 60 * 1000; // 30 minutes for development
      
      if (proofAge > maxProofAge) {
        console.error('Proof expired. Please generate a new proof.');
        setError('Proof expired. Please generate a new proof.');
        localStorage.removeItem('zkProof');
        return;
      }
      
      // Security Check 4: Validate proof hasn't been used (prevent double-mint)
      const mintedKey = `minted:${parsedProof.epoch}:${parsedProof.tier}:${address}`;
      const alreadyMinted = localStorage.getItem(mintedKey);
      if (alreadyMinted) {
        setError('This proof has already been used to mint a badge');
        return;
      }
      
      setProofData(parsedProof);
    } catch (err) {
      console.error('Failed to load proof:', err);
      setError('Failed to load proof data');
    }
  }, [address]);

  const getTierName = (threshold: number) => {
    switch (threshold) {
      case 15: return 'Diamond';
      case 50: return 'Gold';
      case 100: return 'Silver';
      default: return 'Unknown';
    }
  };

  const getTierIcon = (threshold: number) => {
    switch (threshold) {
      case 15: return '💎';
      case 50: return '🥇';
      case 100: return '🥈';
      default: return '🏆';
    }
  };

  const mintBadge = async () => {
    if (!proofData || !isConnected || !address) {
      setError('Please connect your wallet first');
      return;
    }
    
    setIsMinting(true);
    setError('');
    
    try {
      // Security: Validate contract address is set
      if (!CONTRACTS.ZK_SLA_1155 || CONTRACTS.ZK_SLA_1155 === '0x0000000000000000000000000000000000000000') {
        throw new Error('Smart contract not deployed. Please set NEXT_PUBLIC_ZKSLA_ADDR in environment variables.');
      }
      
      // CRITICAL Security Check: Validate actualRtt matches the tier threshold
      if (!proofData.actualRtt || proofData.actualRtt > proofData.tier) {
        throw new Error(
          `Invalid proof: Your actual RTT (${proofData.actualRtt}ms) exceeds the ${getTierName(proofData.tier)} threshold (${proofData.tier}ms). ` +
          `This proof has been tampered with or is invalid.`
        );
      }
      
      // Convert public inputs from hex strings to uint256 array
      const publicInputsUint = proofData.publicInputs.map(input => {
        // Remove 0x prefix if present
        const cleaned = input.replace('0x', '');
        // Handle hex strings vs decimal strings
        if (cleaned.match(/^[0-9a-f]+$/i)) {
          return BigInt('0x' + cleaned);
        }
        return BigInt(input);
      });
      
      console.log('Minting with params:', {
        epoch: BigInt(proofData.epoch),
        threshold: proofData.tier,
        m: 28,
        n: 32,
        root: proofData.root as `0x${string}`,
        proof: proofData.proof as `0x${string}`,
        publicInputs: publicInputsUint,
        actualRtt: proofData.actualRtt || 0
      });

      // Call verifyAndMint on the smart contract
      writeContract({
        address: CONTRACTS.ZK_SLA_1155 as `0x${string}`,
        abi: ZK_SLA_1155_ABI,
        functionName: 'verifyAndMint',
        args: [
          BigInt(proofData.epoch),
          proofData.tier,
          28,
          32,
          proofData.root as `0x${string}`,
          proofData.proof as `0x${string}`,
          publicInputsUint,
          proofData.actualRtt || 0 // Pass the actual RTT achieved
        ]
      });
      
      // Mark proof as used to prevent reuse
      const mintedKey = `minted:${proofData.epoch}:${proofData.tier}:${address}`;
      localStorage.setItem(mintedKey, 'true');
      
    } catch (err) {
      console.error('Minting failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to mint badge');
      setIsMinting(false);
    }
  };

  if (!proofData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <header className="border-b border-zinc-800/50 bg-black/40 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center">
                <span className="text-lg font-medium text-white">Divij</span>
              </Link>
              <ConnectButton />
            </div>
          </div>
        </header>
        
        <main className="flex items-center justify-center min-h-[80vh]">
          <Card className="bg-zinc-950 border-zinc-900 max-w-md">
            <CardContent className="p-8 text-center space-y-4">
              <AlertCircle className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
              <h2 className="text-2xl font-semibold text-zinc-100">No Proof Available</h2>
              <p className="text-zinc-400">You must complete the full flow:</p>
              <ol className="text-left text-sm text-zinc-400 space-y-2 my-4">
                <li>1. Run a performance test</li>
                <li>2. Generate a zero-knowledge proof</li>
                <li>3. Then mint your badge</li>
              </ol>
              <Link href="/test">
                <Button className="bg-zinc-900 text-zinc-100 hover:bg-zinc-800 border border-zinc-800">
                  Start at Step 1: Run Test
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-black/40 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <span className="text-lg font-medium text-white">Divij</span>
            </Link>
            <ConnectButton />
          </div>
        </div>
      </header>

      <main className="relative">
        <div className="max-w-3xl mx-auto px-6 py-20">
          {/* Header Section */}
          <div className="text-center mb-12">
            <div className="w-12 h-12 mx-auto mb-6 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Award className="w-6 h-6 text-zinc-400" />
            </div>
            <h1 className="text-4xl font-bold text-zinc-100 mb-3">
              Mint Your Badge
            </h1>
            <p className="text-sm text-zinc-500">
              Submit your zero-knowledge proof and mint your performance badge on-chain
            </p>
          </div>

          {!isSuccess ? (
            <>
              {/* Proof Summary */}
              <div className="rounded-xl bg-zinc-950 border border-zinc-900 p-8 mb-6">
                <h3 className="text-lg font-medium text-zinc-100 mb-6">Proof Summary</h3>
                
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Badge Tier</div>
                    <div className="text-2xl font-semibold text-zinc-100 flex items-center gap-2">
                      <span>{getTierIcon(proofData.tier)}</span>
                      <span>{getTierName(proofData.tier)}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Threshold</div>
                    <div className="text-2xl font-semibold text-zinc-100">≤{proofData.tier}ms</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Epoch</div>
                    <div className="text-lg font-mono text-zinc-100">{proofData.epoch}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Proof Size</div>
                    <div className="text-lg font-mono text-zinc-100">{proofData.proof.length / 2 - 1} bytes</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Contract Address</div>
                    <div className="text-sm font-mono text-zinc-300 bg-zinc-900 rounded px-3 py-2 break-all">
                      {CONTRACTS.ZK_SLA_1155}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Merkle Root (from on-chain epoch)</div>
                    <div className="text-sm font-mono text-zinc-300 bg-zinc-900 rounded px-3 py-2 break-all">
                      {proofData.root}
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Notice */}
              <div className="rounded-xl bg-blue-500/5 border border-blue-500/10 p-6 mb-6">
                <h3 className="text-sm font-medium text-blue-400 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Security Validation
                </h3>
                <ul className="space-y-2 text-sm text-zinc-400">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">✓</span>
                    <span>Your proof is cryptographically signed and cannot be modified</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">✓</span>
                    <span>The smart contract will verify the proof matches the on-chain Merkle root</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">✓</span>
                    <span>Each proof can only be used once per epoch</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">✓</span>
                    <span>Your raw RTT data remains private - only the proof is submitted</span>
                  </li>
                </ul>
              </div>

              {/* Connection & Mint */}
              <div className="text-center space-y-4">
                {!isConnected ? (
                  <div>
                    <p className="text-sm text-zinc-400 mb-4">Connect your wallet to mint your badge</p>
                    <ConnectButton />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-zinc-400">
                      Connected: <span className="font-mono text-zinc-300">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                    </p>
                    
                    <Button
                      onClick={mintBadge}
                      disabled={isPending || isConfirming || isMinting}
                      size="lg"
                      className="bg-zinc-100 text-black hover:bg-white px-8 py-6 text-base"
                    >
                      {isPending || isConfirming ? 'Minting Badge...' : 'Submit Proof & Mint Badge'}
                    </Button>

                    {isPending && (
                      <p className="text-xs text-zinc-500">
                        Waiting for wallet confirmation...
                      </p>
                    )}
                    
                    {isConfirming && (
                      <p className="text-xs text-zinc-500">
                        Waiting for transaction confirmation...
                      </p>
                    )}
                  </div>
                )}
                
                {error && (
                  <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}
                
                <p className="text-xs text-zinc-600 mt-4">
                  Gas estimate: ~0.0003 ETH on Base Sepolia
                </p>
              </div>
            </>
          ) : (
            /* Success State */
            <div className="rounded-xl bg-zinc-950 border border-zinc-900 p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              
              <h2 className="text-2xl font-bold text-zinc-100 mb-2">Badge Minted Successfully!</h2>
              <p className="text-sm text-zinc-400 mb-8">
                Your {getTierName(proofData.tier)} badge has been minted on Base Sepolia
              </p>

              <div className="space-y-4 mb-8">
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Transaction Hash</div>
                  <a 
                    href={`${CHAIN_CONFIG.BASE_SEPOLIA.blockExplorer}/tx/${hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-mono text-blue-400 hover:text-blue-300 flex items-center justify-center gap-2"
                  >
                    {hash?.slice(0, 10)}...{hash?.slice(-8)}
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Badge Token ID</div>
                  <div className="text-lg font-semibold text-zinc-100">{proofData.tier}</div>
                </div>

                <div>
                  <div className="text-xs text-zinc-500 mb-1">Your Address</div>
                  <div className="text-sm font-mono text-zinc-300">{address}</div>
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                <Link href="/leaderboard">
                  <Button variant="outline" className="border-zinc-800 text-zinc-300 hover:bg-zinc-900">
                    View Leaderboard
                  </Button>
                </Link>
                <Link href="/test">
                  <Button className="bg-zinc-900 text-zinc-100 hover:bg-zinc-800 border border-zinc-800">
                    Run Another Test
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}