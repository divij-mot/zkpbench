// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../src/EpochManager.sol";
import "../src/ZkSLA1155.sol";
import "../src/RttThresholdVerifier.sol";

contract DeployProduction is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying with account:", deployer);
        console.log("Account balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy RTT Threshold Verifier
        RttThresholdVerifier verifier = new RttThresholdVerifier();
        console.log("RttThresholdVerifier deployed to:", address(verifier));

        // Deploy Epoch Manager
        EpochManager epochManager = new EpochManager(deployer);
        console.log("EpochManager deployed to:", address(epochManager));

        // Set deployer as authorized verifier
        epochManager.setVerifier(deployer, true);
        console.log("Deployer set as authorized verifier");

        // Deploy ZkSLA1155 Badge Contract
        string memory uri = "https://zk-sla.vercel.app/api/metadata/{id}.json";
        ZkSLA1155 zkSLA = new ZkSLA1155(
            deployer,
            epochManager,
            verifier,
            uri
        );
        console.log("ZkSLA1155 deployed to:", address(zkSLA));

        // Log deployment summary
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network: Base Sepolia (Chain ID: 84532)");
        console.log("Deployer:", deployer);
        console.log("RTT Verifier:", address(verifier));
        console.log("Epoch Manager:", address(epochManager));
        console.log("ZK-SLA Badge:", address(zkSLA));
        console.log("");
        console.log("Add these to your .env:");
        console.log("NEXT_PUBLIC_RTT_VERIFIER_ADDR=", address(verifier));
        console.log("NEXT_PUBLIC_EPOCH_MANAGER_ADDR=", address(epochManager));
        console.log("NEXT_PUBLIC_ZKSLA_ADDR=", address(zkSLA));

        vm.stopBroadcast();
    }
}