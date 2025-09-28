// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test, console} from "forge-std/Test.sol";
import {EpochManager} from "../src/EpochManager.sol";
import {ZkSLA1155} from "../src/ZkSLA1155.sol";
import {MockVerifier} from "../src/MockVerifier.sol";

contract ZkSLA1155Test is Test {
    EpochManager public manager;
    ZkSLA1155 public zkSLA;
    MockVerifier public mockVerifier;

    address public owner = makeAddr("owner");
    address public verifier = makeAddr("verifier");
    address public user = makeAddr("user");

    bytes32 public constant ROOT = keccak256("test root");
    uint256 public constant EPOCH = 1;
    uint32 public constant TIER_75 = 75;
    uint32 public constant TIER_150 = 150;
    uint32 public constant TIER_300 = 300;

    function setUp() public {
        vm.startPrank(owner);
        manager = new EpochManager(owner);
        mockVerifier = new MockVerifier();
        zkSLA = new ZkSLA1155(owner, manager, mockVerifier, "https://api.example.com/metadata/{id}.json");

        manager.setVerifier(verifier, true);
        vm.stopPrank();

        vm.prank(verifier);
        manager.finalizeEpoch(EPOCH, ROOT);
    }

    function testVerifyAndMint() public {
        uint16 m = 28;
        uint16 n = 32;
        bytes memory proof = "mock proof";
        uint256[] memory publicInputs = new uint256[](5);
        publicInputs[0] = uint256(ROOT);
        publicInputs[1] = TIER_150;
        publicInputs[2] = m;
        publicInputs[3] = n;
        publicInputs[4] = EPOCH;

        vm.prank(user);
        vm.expectEmit(true, true, false, true);
        emit ZkSLA1155.Verified(user, EPOCH, TIER_150);
        zkSLA.verifyAndMint(EPOCH, TIER_150, m, n, ROOT, proof, publicInputs);

        assertEq(zkSLA.balanceOf(user, uint256(TIER_150)), 1);
        assertTrue(zkSLA.hasMinted(user, EPOCH, TIER_150));
    }

    function testCannotMintWithInvalidTier() public {
        uint32 invalidTier = 999;
        uint16 m = 28;
        uint16 n = 32;
        bytes memory proof = "mock proof";
        uint256[] memory publicInputs = new uint256[](5);

        vm.prank(user);
        vm.expectRevert(ZkSLA1155.InvalidTier.selector);
        zkSLA.verifyAndMint(EPOCH, invalidTier, m, n, ROOT, proof, publicInputs);
    }

    function testCannotMintWithInvalidRoot() public {
        bytes32 wrongRoot = keccak256("wrong root");
        uint16 m = 28;
        uint16 n = 32;
        bytes memory proof = "mock proof";
        uint256[] memory publicInputs = new uint256[](5);

        vm.prank(user);
        vm.expectRevert(ZkSLA1155.InvalidRoot.selector);
        zkSLA.verifyAndMint(EPOCH, TIER_150, m, n, wrongRoot, proof, publicInputs);
    }

    function testCannotMintWithInvalidProof() public {
        mockVerifier.setVerificationResult(false);
        uint16 m = 28;
        uint16 n = 32;
        bytes memory proof = "invalid proof";
        uint256[] memory publicInputs = new uint256[](5);

        vm.prank(user);
        vm.expectRevert(ZkSLA1155.InvalidProof.selector);
        zkSLA.verifyAndMint(EPOCH, TIER_150, m, n, ROOT, proof, publicInputs);
    }

    function testCannotMintTwice() public {
        uint16 m = 28;
        uint16 n = 32;
        bytes memory proof = "mock proof";
        uint256[] memory publicInputs = new uint256[](5);
        publicInputs[0] = uint256(ROOT);
        publicInputs[1] = TIER_150;
        publicInputs[2] = m;
        publicInputs[3] = n;
        publicInputs[4] = EPOCH;

        vm.prank(user);
        zkSLA.verifyAndMint(EPOCH, TIER_150, m, n, ROOT, proof, publicInputs);

        vm.prank(user);
        vm.expectRevert(ZkSLA1155.AlreadyMinted.selector);
        zkSLA.verifyAndMint(EPOCH, TIER_150, m, n, ROOT, proof, publicInputs);
    }

    function testGetTierBalance() public {
        uint16 m = 28;
        uint16 n = 32;
        bytes memory proof = "mock proof";
        uint256[] memory publicInputs = new uint256[](5);
        publicInputs[0] = uint256(ROOT);
        publicInputs[1] = TIER_75;
        publicInputs[2] = m;
        publicInputs[3] = n;
        publicInputs[4] = EPOCH;

        assertEq(zkSLA.getTierBalance(user, TIER_75), 0);

        vm.prank(user);
        zkSLA.verifyAndMint(EPOCH, TIER_75, m, n, ROOT, proof, publicInputs);

        assertEq(zkSLA.getTierBalance(user, TIER_75), 1);
    }

    function testOwnerCanSetTier() public {
        uint32 newTier = 500;
        assertFalse(zkSLA.isTier(newTier));

        vm.prank(owner);
        zkSLA.setTier(newTier, true);

        assertTrue(zkSLA.isTier(newTier));
    }

    function testOwnerCanSetVerifier() public {
        MockVerifier newVerifier = new MockVerifier();

        vm.prank(owner);
        zkSLA.setVerifier(newVerifier);

        assertEq(address(zkSLA.verifier()), address(newVerifier));
    }
}