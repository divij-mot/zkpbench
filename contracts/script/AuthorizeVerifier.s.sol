// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {EpochManager} from "../src/EpochManager.sol";

contract AuthorizeVerifierScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address epochManagerAddress = vm.envAddress("EPOCH_MANAGER_ADDRESS");
        address verifierAddress = vm.envAddress("VERIFIER_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        EpochManager epochManager = EpochManager(epochManagerAddress);
        
        // Authorize the verifier
        epochManager.setVerifier(verifierAddress, true);
        
        console.log("====================================");
        console.log("Verifier Authorization Complete!");
        console.log("====================================");
        console.log("EpochManager:", epochManagerAddress);
        console.log("Verifier Address:", verifierAddress);
        console.log("Is Authorized:", epochManager.isVerifier(verifierAddress));
        console.log("====================================");

        vm.stopBroadcast();
    }
}
