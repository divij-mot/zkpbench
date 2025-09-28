// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test, console} from "forge-std/Test.sol";
import {EpochManager, IEpochManager} from "../src/EpochManager.sol";

contract EpochManagerTest is Test {
    EpochManager public manager;
    address public owner = makeAddr("owner");
    address public verifier = makeAddr("verifier");
    address public unauthorized = makeAddr("unauthorized");

    function setUp() public {
        vm.prank(owner);
        manager = new EpochManager(owner);
    }

    function testSetVerifier() public {
        vm.prank(owner);
        manager.setVerifier(verifier, true);
        assertTrue(manager.isVerifier(verifier));

        vm.prank(owner);
        manager.setVerifier(verifier, false);
        assertFalse(manager.isVerifier(verifier));
    }

    function testSetVerifierOnlyOwner() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        manager.setVerifier(verifier, true);
    }

    function testFinalizeEpoch() public {
        bytes32 root = keccak256("test root");
        uint256 epoch = 1;

        vm.prank(owner);
        manager.setVerifier(verifier, true);

        vm.prank(verifier);
        vm.expectEmit(true, false, false, true);
        emit IEpochManager.EpochFinalized(epoch, root);
        manager.finalizeEpoch(epoch, root);

        assertEq(manager.rootOf(epoch), root);
    }

    function testFinalizeEpochOnlyVerifier() public {
        bytes32 root = keccak256("test root");
        uint256 epoch = 1;

        vm.prank(unauthorized);
        vm.expectRevert(EpochManager.UnauthorizedVerifier.selector);
        manager.finalizeEpoch(epoch, root);
    }

    function testCannotFinalizeEpochTwice() public {
        bytes32 root1 = keccak256("test root 1");
        bytes32 root2 = keccak256("test root 2");
        uint256 epoch = 1;

        vm.prank(owner);
        manager.setVerifier(verifier, true);

        vm.prank(verifier);
        manager.finalizeEpoch(epoch, root1);

        vm.prank(verifier);
        vm.expectRevert(EpochManager.EpochAlreadyFinalized.selector);
        manager.finalizeEpoch(epoch, root2);
    }

    function testCannotFinalizeWithZeroRoot() public {
        uint256 epoch = 1;

        vm.prank(owner);
        manager.setVerifier(verifier, true);

        vm.prank(verifier);
        vm.expectRevert(EpochManager.InvalidRoot.selector);
        manager.finalizeEpoch(epoch, bytes32(0));
    }
}