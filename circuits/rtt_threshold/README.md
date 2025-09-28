# RTT Threshold Circuit

This Noir circuit proves that a user met an RTT (Round Trip Time) SLA without revealing their actual RTT measurements.

## Circuit Logic

The circuit proves:
1. **m-of-n compliance**: At least `m` out of `n` RTT samples are ≤ threshold `T`
2. **Merkle inclusion**: Each sample is included in the committed Merkle tree root
3. **Distinct samples**: No duplicate indices are used
4. **Bounds checking**: All indices are within valid range [0, n)

## Inputs

### Public Inputs
- `root`: Merkle root of all RTT samples (posted on-chain)
- `threshold`: Maximum allowed RTT in milliseconds
- `m`: Required number of successful samples
- `n`: Total number of samples in the epoch
- `epoch`: Epoch identifier

### Private Inputs (Witness)
- `indices[M_MAX]`: Array of sample indices to prove
- `nonces[M_MAX]`: Random nonces for each sample
- `rtts[M_MAX]`: RTT values in milliseconds
- `merkle_paths[M_MAX][MERKLE_DEPTH]`: Merkle inclusion proofs

## Leaf Construction

Each leaf in the Merkle tree is computed as:
```
leaf = Poseidon(Poseidon(idx, nonce), rtt)
```

This provides domain separation and ensures the integrity of all sample components.

## Constants

- `M_MAX = 28`: Maximum number of proofs (for consistent constraint count)
- `MERKLE_DEPTH = 16`: Maximum tree depth (supports up to 65,536 samples)

## Building

```bash
# Check circuit syntax
nargo check

# Compile circuit
nargo compile

# Run tests
nargo test

# Generate proving key (requires nargo CLI)
nargo prove-keygen
```

## Integration

The circuit generates proofs compatible with the `ZkSLA1155` smart contract's verification requirements.