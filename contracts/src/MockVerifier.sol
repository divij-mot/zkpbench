// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IVerifier} from "./IVerifier.sol";

contract MockVerifier is IVerifier {
    bool public shouldVerify = true;

    function setVerificationResult(bool result) external {
        shouldVerify = result;
    }

    function verifyProof(bytes calldata, uint256[] calldata) external view returns (bool) {
        return shouldVerify;
    }
}