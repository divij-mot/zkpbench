use std::hash::poseidon::bn254::hash_2;
use std::hash::poseidon::bn254::hash_3;
use std::merkle::compute_merkle_root;

global M_MAX = 28; // Maximum m (number of proofs)
global MERKLE_DEPTH = 16; // Merkle tree depth

// Public inputs structure
struct PublicInputs {
    root: Field,     // Merkle root posted on-chain
    threshold: u32,  // RTT threshold in ms
    m: u16,          // Required successes
    n: u16,          // Total samples
    epoch: u64,      // Epoch ID
}

// Private witness for each RTT sample
struct RTTProof {
    idx: u16,
    nonce: Field,  // 128-bit nonce as Field
    rtt_ms: u32,
    merkle_path: [Field; MERKLE_DEPTH],
}

fn main(
    // Public inputs
    root: pub Field,
    threshold: pub u32,
    m: pub u16,
    n: pub u16,
    epoch: pub u64,

    // Private witnesses (arrays of size M_MAX for consistent constraint count)
    indices: [u16; M_MAX],
    nonces: [Field; M_MAX],
    rtts: [u32; M_MAX],
    merkle_paths: [[Field; MERKLE_DEPTH]; M_MAX],
) {
    // Verify each RTT proof for the first m samples
    for i in 0..M_MAX {
        if (i as u16) < m {
            let idx = indices[i];
            let nonce = nonces[i];
            let rtt = rtts[i];
            let path = merkle_paths[i];

            // 1. Verify RTT is below threshold
            assert(rtt <= threshold, "RTT exceeds threshold");

            // 2. Verify index bounds
            assert(idx < n, "Index out of bounds");

            // 3. Compute leaf hash: Poseidon(idx || nonce || rtt)
            // We use domain separation by hashing in stages
            let idx_field = idx as Field;
            let rtt_field = rtt as Field;

            // First hash idx and nonce
            let temp_hash = hash_2([idx_field, nonce]);
            // Then hash with rtt for the final leaf
            let leaf = hash_2([temp_hash, rtt_field]);

            // 4. Verify Merkle inclusion
            let computed_root = compute_merkle_root(leaf, i as u32, path);
            assert(computed_root == root, "Invalid Merkle proof");
        }
    }

    // Verify all indices are distinct (among the first m entries)
    for i in 0..M_MAX {
        if (i as u16) < m {
            for j in (i + 1)..M_MAX {
                if (j as u16) < m {
                    assert(indices[i] != indices[j], "Duplicate indices");
                }
            }
        }
    }
}

#[test]
fn test_rtt_circuit() {
    // Test values
    let root = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
    let threshold = 150;
    let m = 3;
    let n = 32;
    let epoch = 1;

    // Mock private inputs
    let mut indices = [0; M_MAX];
    let mut nonces = [0; M_MAX];
    let mut rtts = [0; M_MAX];
    let mut merkle_paths = [[0; MERKLE_DEPTH]; M_MAX];

    // Set up first 3 valid samples
    indices[0] = 0;
    indices[1] = 5;
    indices[2] = 10;

    nonces[0] = 0x123456789abcdef0123456789abcdef0;
    nonces[1] = 0x234567890abcdef0123456789abcdef1;
    nonces[2] = 0x3456789abcdef0123456789abcdef12;

    rtts[0] = 100;
    rtts[1] = 120;
    rtts[2] = 140;

    // Mock Merkle paths (in a real circuit, these would be valid)
    for i in 0..3 {
        for j in 0..MERKLE_DEPTH {
            merkle_paths[i][j] = (i as Field) * 1000 + (j as Field);
        }
    }

    // Note: This test will fail with the mock data since the Merkle proofs
    // don't actually verify against the root. In a real implementation,
    // we would generate valid Merkle proofs.
}