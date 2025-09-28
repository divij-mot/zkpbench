// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IEpochManager {
    event EpochFinalized(uint256 indexed epoch, bytes32 root);

    function rootOf(uint256 epoch) external view returns (bytes32);
    function setVerifier(address who, bool isOk) external;
    function finalizeEpoch(uint256 epoch, bytes32 root) external;
}

contract EpochManager is IEpochManager, Ownable {
    mapping(address => bool) public isVerifier;
    mapping(uint256 => bytes32) public rootOf;

    error UnauthorizedVerifier();
    error EpochAlreadyFinalized();
    error InvalidRoot();

    modifier onlyVerifier() {
        if (!isVerifier[msg.sender]) revert UnauthorizedVerifier();
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setVerifier(address who, bool isOk) external onlyOwner {
        isVerifier[who] = isOk;
    }

    function finalizeEpoch(uint256 epoch, bytes32 root) external onlyVerifier {
        if (rootOf[epoch] != bytes32(0)) revert EpochAlreadyFinalized();
        if (root == bytes32(0)) revert InvalidRoot();

        rootOf[epoch] = root;
        emit EpochFinalized(epoch, root);
    }
}