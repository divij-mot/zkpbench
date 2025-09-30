// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IEpochManager} from "./EpochManager.sol";
import {IVerifier} from "./IVerifier.sol";

contract ZkSLA1155 is ERC1155, Ownable {
    IEpochManager public immutable mgr;
    IVerifier public verifier;

    mapping(uint32 => bool) public isTier;
    mapping(address => mapping(uint256 => mapping(uint32 => bool))) public hasMinted;
    
    // Store best RTT (in ms) for each user per epoch
    mapping(address => mapping(uint256 => uint32)) public bestRtt;

    event Verified(address indexed user, uint256 indexed epoch, uint32 threshold, uint32 actualRtt);

    error InvalidTier();
    error InvalidRoot();
    error InvalidProof();
    error AlreadyMinted();

    constructor(
        address initialOwner,
        IEpochManager _mgr,
        IVerifier _verifier,
        string memory uri
    ) ERC1155(uri) Ownable(initialOwner) {
        mgr = _mgr;
        verifier = _verifier;

        // Updated tier thresholds
        isTier[15] = true;  // Diamond: <15ms
        isTier[50] = true;  // Gold: <50ms
        isTier[100] = true; // Silver: <100ms
    }

    function setVerifier(IVerifier _verifier) external onlyOwner {
        verifier = _verifier;
    }

    function setTier(uint32 threshold, bool enabled) external onlyOwner {
        isTier[threshold] = enabled;
    }

    function verifyAndMint(
        uint256 epoch,
        uint32 T,
        uint16, // m - kept for interface compatibility
        uint16, // n - kept for interface compatibility
        bytes32 root,
        bytes calldata proof,
        uint256[] calldata publicInputs,
        uint32 actualRtt // The actual best RTT achieved
    ) external {
        if (!isTier[T]) revert InvalidTier();
        if (mgr.rootOf(epoch) != root) revert InvalidRoot();
        
        // Check if this is an improvement over previous attempts
        uint32 currentBest = bestRtt[msg.sender][epoch];
        if (currentBest > 0 && actualRtt >= currentBest) {
            revert AlreadyMinted(); // Not an improvement
        }
        
        // Check if already minted this tier for this epoch
        if (hasMinted[msg.sender][epoch][T]) revert AlreadyMinted();

        if (!verifier.verifyProof(proof, publicInputs)) revert InvalidProof();

        hasMinted[msg.sender][epoch][T] = true;
        bestRtt[msg.sender][epoch] = actualRtt;

        uint256 id = uint256(T);
        _mint(msg.sender, id, 1, "");

        emit Verified(msg.sender, epoch, T, actualRtt);
    }

    function getTierBalance(address account, uint32 tier) external view returns (uint256) {
        return balanceOf(account, uint256(tier));
    }
}