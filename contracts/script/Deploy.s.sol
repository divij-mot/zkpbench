// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {EpochManager} from "../src/EpochManager.sol";
import {ZkSLA1155} from "../src/ZkSLA1155.sol";
import {MockVerifier} from "../src/MockVerifier.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        console.log("Deploying contracts with account:", deployer);
        console.log("Account balance:", deployer.balance);

        EpochManager epochManager = new EpochManager(deployer);
        console.log("EpochManager deployed at:", address(epochManager));

        MockVerifier mockVerifier = new MockVerifier();
        console.log("MockVerifier deployed at:", address(mockVerifier));

        string memory uri = "https://api.zk-sla.com/metadata/{id}.json";
        ZkSLA1155 zkSLA = new ZkSLA1155(deployer, epochManager, mockVerifier, uri);
        console.log("ZkSLA1155 deployed at:", address(zkSLA));

        epochManager.setVerifier(deployer, true);
        console.log("Set deployer as verifier");

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Summary ===");
        console.log("EpochManager:", address(epochManager));
        console.log("MockVerifier:", address(mockVerifier));
        console.log("ZkSLA1155:", address(zkSLA));
        console.log("Deployer/Owner:", deployer);
        console.log("");
        console.log("Add these to your .env file:");
        console.log("NEXT_PUBLIC_EPOCH_MANAGER_ADDR=", address(epochManager));
        console.log("NEXT_PUBLIC_ZKSLA_ADDR=", address(zkSLA));
        console.log("NEXT_PUBLIC_MOCK_VERIFIER_ADDR=", address(mockVerifier));
    }
}