// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IVerifier {
    function verifyProof(bytes calldata proof, uint256[] calldata publicInputs) external view returns (bool);
}