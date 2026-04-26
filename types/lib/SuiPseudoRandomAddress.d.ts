/**
 * Deterministically derives an Ed25519 keypair (and thus a Sui address) from an arbitrary
 * string seed. Useful for tests and local dev where you need a stable, human-readable
 * "name" instead of a raw private key.
 *
 * The derivation is deterministic but **not cryptographically secure** — the hash function
 * is intentionally simple. Do not use for production key management.
 */
export default class SuiPseudoRandomAddress {
    /**
     * Derive an Ed25519 keypair from an arbitrary string seed.
     * The same string always produces the same keypair (and Sui address).
     *
     * @param {string} as - any string seed, e.g. `'alice'`, `'test-wallet-1'`
     * @returns {Ed25519Keypair}
     */
    static stringToKeyPair(as: string): Ed25519Keypair;
    /**
     * Convert an arbitrary string seed into a BIP-39 mnemonic phrase by mapping the string
     * to 32 pseudo-random bytes and running them through `entropyToMnemonic`.
     *
     * The byte derivation:
     *  1. Repeats the string until it is at least 32 chars (appending `*"` so `'test'` and
     *     `'testtest'` produce different entropy).
     *  2. Maps each character to its char-code.
     *  3. Folds any bytes beyond position 31 back into the first 32 via modular addition.
     *
     * @param {string} as - any string seed
     * @returns {string} 24-word BIP-39 mnemonic derived from the seed
     */
    static stringToPhrase(as: string): string;
}
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
