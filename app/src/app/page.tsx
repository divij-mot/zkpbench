'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Shield, Zap, Clock, Award, ArrowRight, Check } from 'lucide-react';

export default function Home() {
  const { isConnected, address } = useAccount();
  const [currentStep, setCurrentStep] = useState(0);
  const [testInProgress, setTestInProgress] = useState(false);

  const steps = [
    'Connect Wallet',
    'Run Speed Test',
    'Generate Proof',
    'Mint Badge'
  ];

  const features = [
    {
      icon: Shield,
      title: 'Zero-Knowledge Privacy',
      description: 'Prove your network performance without revealing actual RTT measurements or IP addresses.'
    },
    {
      icon: Zap,
      title: 'Real-Time Testing',
      description: '32 RTT challenges over 45 seconds with anti-cheat measures and fresh cryptographic nonces.'
    },
    {
      icon: Clock,
      title: 'Instant Verification',
      description: 'Browser-based proving with sub-20s proof generation using Noir circuits and Poseidon hashing.'
    },
    {
      icon: Award,
      title: 'Tiered Badges',
      description: 'Earn ERC-1155 badges for different performance tiers: ≤75ms, ≤150ms, or ≤300ms.'
    }
  ];

  useEffect(() => {
    if (isConnected) {
      setCurrentStep(1);
    } else {
      setCurrentStep(0);
    }
  }, [isConnected]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-indigo-500 via-sky-500 to-teal-400 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">zk-SLA</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <ConnectButton />
          </motion.div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mb-8"
          >
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              Prove performance{' '}
              <span className="bg-gradient-to-r from-indigo-500 via-sky-500 to-teal-400 bg-clip-text text-transparent">
                privately
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-zinc-400 max-w-3xl mx-auto leading-relaxed">
              A zero-knowledge speed test: prove you met an SLA and mint the proof on-chain — no logs, no leaks.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mb-16"
          >
            {isConnected ? (
              <Button
                size="xl"
                className="relative overflow-hidden group"
                onClick={() => window.location.href = '/test'}
                disabled={testInProgress}
              >
                {testInProgress ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
                    Running Test...
                  </>
                ) : (
                  <>
                    Run zk-SLA Test
                    <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            ) : (
              <Button size="xl" variant="outline" disabled>
                Connect Wallet to Start
              </Button>
            )}
          </motion.div>

          {/* Progress Steps */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="max-w-2xl mx-auto mb-20"
          >
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step} className="flex items-center">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300
                    ${index <= currentStep
                      ? 'bg-gradient-to-r from-indigo-500 via-sky-500 to-teal-400 text-white'
                      : 'bg-zinc-800 text-zinc-400'
                    }
                  `}>
                    {index < currentStep ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className="ml-2 text-sm text-zinc-400 hidden sm:block">{step}</span>
                  {index < steps.length - 1 && (
                    <div className={`
                      w-16 h-0.5 mx-4 transition-all duration-300
                      ${index < currentStep ? 'bg-gradient-to-r from-indigo-500 to-teal-400' : 'bg-zinc-800'}
                    `} />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-20 bg-zinc-900/20">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              How it works
            </h2>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
              Advanced cryptography meets seamless user experience
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: index * 0.1 }}
              >
                <Card className="h-full hover:shadow-2xl transition-all duration-300 hover:scale-105">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-indigo-500 via-sky-500 to-teal-400 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-zinc-400 leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-teal-400 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium">zk-SLA</span>
          </div>
          <div className="text-sm text-zinc-400">
            Zero-knowledge privacy for DePIN networks
          </div>
        </div>
      </footer>
    </div>
  );
}
