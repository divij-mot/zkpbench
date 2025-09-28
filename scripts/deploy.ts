#!/usr/bin/env tsx

/**
 * zk-SLA Deployment Script
 *
 * This script deploys the zk-SLA smart contracts to a target network
 * and updates the environment configuration files.
 */

import { spawn } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

interface DeploymentResult {
  epochManager: string;
  mockVerifier: string;
  zkSLA1155: string;
  deployer: string;
}

async function runCommand(command: string, args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      cwd: cwd || process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });
  });
}

async function parseDeploymentOutput(output: string): Promise<DeploymentResult> {
  // Extract contract addresses from forge script output
  const lines = output.split('\n');

  let epochManager = '';
  let mockVerifier = '';
  let zkSLA1155 = '';
  let deployer = '';

  for (const line of lines) {
    if (line.includes('EpochManager deployed at:')) {
      epochManager = line.split(':')[1].trim();
    }
    if (line.includes('MockVerifier deployed at:')) {
      mockVerifier = line.split(':')[1].trim();
    }
    if (line.includes('ZkSLA1155 deployed at:')) {
      zkSLA1155 = line.split(':')[1].trim();
    }
    if (line.includes('Deployer/Owner:')) {
      deployer = line.split(':')[1].trim();
    }
  }

  if (!epochManager || !mockVerifier || !zkSLA1155 || !deployer) {
    throw new Error('Failed to parse deployment addresses from output');
  }

  return { epochManager, mockVerifier, zkSLA1155, deployer };
}

async function updateEnvironmentFiles(addresses: DeploymentResult, network: string) {
  // Update app/.env
  const appEnvPath = join(process.cwd(), 'app', '.env');
  let appEnvContent = '';

  try {
    appEnvContent = readFileSync(appEnvPath, 'utf-8');
  } catch {
    // File doesn't exist, create from example
    const examplePath = join(process.cwd(), 'app', '.env.example');
    appEnvContent = readFileSync(examplePath, 'utf-8');
  }

  // Update contract addresses
  appEnvContent = appEnvContent.replace(
    /NEXT_PUBLIC_EPOCH_MANAGER_ADDR=.*/,
    `NEXT_PUBLIC_EPOCH_MANAGER_ADDR=${addresses.epochManager}`
  );
  appEnvContent = appEnvContent.replace(
    /NEXT_PUBLIC_ZKSLA_ADDR=.*/,
    `NEXT_PUBLIC_ZKSLA_ADDR=${addresses.zkSLA1155}`
  );
  appEnvContent = appEnvContent.replace(
    /NEXT_PUBLIC_MOCK_VERIFIER_ADDR=.*/,
    `NEXT_PUBLIC_MOCK_VERIFIER_ADDR=${addresses.mockVerifier}`
  );

  writeFileSync(appEnvPath, appEnvContent);

  // Update verifier/.env
  const verifierEnvPath = join(process.cwd(), 'verifier', '.env');
  let verifierEnvContent = `RPC_URL=${getRPCUrl(network)}
EPOCH_MANAGER_ADDR=${addresses.epochManager}
PORT=3001
VERIFIER_PRIVKEY=your_private_key_here
`;

  writeFileSync(verifierEnvPath, verifierEnvContent);
}

function getRPCUrl(network: string): string {
  switch (network) {
    case 'base-sepolia':
      return 'https://sepolia.base.org';
    case 'sepolia':
      return 'https://ethereum-sepolia-rpc.publicnode.com';
    default:
      return 'http://localhost:8545';
  }
}

async function main() {
  const network = process.argv[2] || 'base-sepolia';
  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.RPC_URL || getRPCUrl(network);

  if (!privateKey) {
    console.error('❌ PRIVATE_KEY environment variable is required');
    process.exit(1);
  }

  console.log(`🚀 Deploying zk-SLA contracts to ${network}...`);
  console.log(`📡 RPC URL: ${rpcUrl}`);

  try {
    // Change to contracts directory
    const contractsDir = join(process.cwd(), 'contracts');

    // Run forge script
    console.log('📄 Running deployment script...');
    const output = await runCommand(
      'forge',
      [
        'script',
        'script/Deploy.s.sol',
        '--rpc-url',
        rpcUrl,
        '--private-key',
        privateKey,
        '--broadcast',
        '--verify'
      ],
      contractsDir
    );

    console.log('✅ Contracts deployed successfully!');

    // Parse addresses from output
    console.log('🔍 Parsing deployment addresses...');
    const addresses = await parseDeploymentOutput(output);

    console.log('📝 Contract addresses:');
    console.log(`   EpochManager: ${addresses.epochManager}`);
    console.log(`   MockVerifier: ${addresses.mockVerifier}`);
    console.log(`   ZkSLA1155:    ${addresses.zkSLA1155}`);
    console.log(`   Deployer:     ${addresses.deployer}`);

    // Update environment files
    console.log('🔧 Updating environment files...');
    await updateEnvironmentFiles(addresses, network);

    console.log('');
    console.log('🎉 Deployment completed successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Update verifier/.env with your private key');
    console.log('2. Start the development environment: npm run dev');
    console.log('3. Test the full flow in the browser');
    console.log('');
    console.log(`🔗 Block explorer: ${getExplorerUrl(network)}`);

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

function getExplorerUrl(network: string): string {
  switch (network) {
    case 'base-sepolia':
      return 'https://sepolia.basescan.org';
    case 'sepolia':
      return 'https://sepolia.etherscan.io';
    default:
      return 'http://localhost:8545';
  }
}

// Run the deployment
if (require.main === module) {
  main().catch(console.error);
}