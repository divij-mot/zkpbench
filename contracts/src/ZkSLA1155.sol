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

    event Verified(address indexed user, uint256 indexed epoch, uint32 threshold);

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

        isTier[75] = true;
        isTier[150] = true;
        isTier[300] = true;
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
        uint256[] calldata publicInputs
    ) external {
        if (!isTier[T]) revert InvalidTier();
        if (mgr.rootOf(epoch) != root) revert InvalidRoot();
        if (hasMinted[msg.sender][epoch][T]) revert AlreadyMinted();

        if (!verifier.verifyProof(proof, publicInputs)) revert InvalidProof();

        hasMinted[msg.sender][epoch][T] = true;

        uint256 id = uint256(T);
        _mint(msg.sender, id, 1, "");

        emit Verified(msg.sender, epoch, T);
    }

    function getTierBalance(address account, uint32 tier) external view returns (uint256) {
        return balanceOf(account, uint256(tier));
    }
}