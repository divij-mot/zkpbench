'use client';

import { RTTSample } from './zk-proving';

export interface Challenge {
  type: 'challenge';
  idx: number;
  nonce: string;
  ttl: number;
}

export interface ChallengeResult {
  type: 'result';
  idx: number;
  rtt: number;
  valid: boolean;
}

export interface TestComplete {
  type: 'complete';
  epoch: number;
  root: string;
  samples: RTTSample[];
  eligibleTiers: {
    tier75: boolean;
    tier150: boolean;
    tier300: boolean;
  };
}

export type WebSocketMessage = Challenge | ChallengeResult | TestComplete | { type: 'error'; error: string };

export interface TestProgress {
  completed: number;
  total: number;
  currentRTT?: number;
  averageRTT: number;
  validSamples: number;
}

export class RTTTestService {
  private ws: WebSocket | null = null;
  private address: string = '';
  private samples: RTTSample[] = [];
  private onProgressCallback?: (progress: TestProgress) => void;
  private onCompleteCallback?: (result: TestComplete) => void;
  private onErrorCallback?: (error: string) => void;

  constructor(
    private verifierUrl: string = 'ws://localhost:3001'
  ) {}

  startTest(
    address: string,
    onProgress: (progress: TestProgress) => void,
    onComplete: (result: TestComplete) => void,
    onError: (error: string) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.address = address;
      this.samples = [];
      this.onProgressCallback = onProgress;
      this.onCompleteCallback = onComplete;
      this.onErrorCallback = onError;

      try {
        this.ws = new WebSocket(`${this.verifierUrl}/session/${address}`);

        this.ws.onopen = () => {
          console.log('Connected to RTT test service');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
            onError('Failed to parse server response');
          }
        };

        this.ws.onclose = () => {
          console.log('Disconnected from RTT test service');
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(new Error('Failed to connect to test service'));
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(message: WebSocketMessage) {
    switch (message.type) {
      case 'challenge':
        this.handleChallenge(message);
        break;

      case 'result':
        this.handleResult(message);
        break;

      case 'complete':
        this.handleComplete(message);
        break;

      case 'error':
        this.onErrorCallback?.(message.error);
        break;

      default:
        console.warn('Unknown message type:', message);
    }
  }

  private handleChallenge(challenge: Challenge) {
    const startTime = Date.now();

    // Immediately echo back the challenge
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'echo',
        idx: challenge.idx,
        nonce: challenge.nonce,
        timestamp: startTime,
      }));
    }
  }

  private handleResult(result: ChallengeResult) {
    // Store the RTT sample
    const sample: RTTSample = {
      idx: result.idx,
      nonce: '', // Will be populated from server
      rtt: result.rtt,
      timestamp: Date.now(),
    };

    this.samples.push(sample);

    // Calculate progress
    const validSamples = this.samples.filter(s => s.rtt < 5000);
    const averageRTT = validSamples.length > 0
      ? validSamples.reduce((sum, s) => sum + s.rtt, 0) / validSamples.length
      : 0;

    const progress: TestProgress = {
      completed: this.samples.length,
      total: 32, // TOTAL_CHALLENGES
      currentRTT: result.rtt,
      averageRTT,
      validSamples: validSamples.length,
    };

    this.onProgressCallback?.(progress);
  }

  private handleComplete(result: TestComplete) {
    this.onCompleteCallback?.(result);
    this.disconnect();
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // Utility to fetch bundle data for proving
  async fetchBundle(epoch: number): Promise<any> {
    const response = await fetch(`${this.verifierUrl.replace('ws://', 'http://').replace('wss://', 'https://')}/bundle/${epoch}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch bundle: ${response.statusText}`);
    }
    return response.json();
  }
}

// Create a singleton instance
export const rttTestService = new RTTTestService(
  typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_VERIFIER_URL
    : undefined
);