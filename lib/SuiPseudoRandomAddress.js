import { entropyToMnemonic } from '@scure/bip39';
import { wordlist} from '@scure/bip39/wordlists/english.js';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

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
    static stringToKeyPair(as) {
        const pseudoRandomPhrase = SuiPseudoRandomAddress.stringToPhrase(as);
        return Ed25519Keypair.deriveKeypair(pseudoRandomPhrase);
    }

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
    static stringToPhrase(as) {
        let asToHash = `${as}`;
        // calculate very simple 32 bytes hash of a string
        do {
            asToHash = asToHash.repeat(2) + '*"'; // just some chars so 'test' and 'testtest' would not produce the same hash
        } while (asToHash.length < 32);
        const asBytes = Array.from(`${asToHash}`).map((e) => e.charCodeAt(0));
        if (asBytes.length > 32) {
            // we fill all bytes into first 32 bytes
            for (let i = 32; i < asBytes.length; i++) {
                const addToPos = i % 32;
                asBytes[addToPos] = (asBytes[addToPos] + asBytes[i]) % 256;
            }
        }
        const asUint8Array = new Uint8Array(32);
        asUint8Array.set(asBytes.slice(0,32));
        // use @scure/bip39 to get mnemonic out of pseudo-random array:
        const phrase = entropyToMnemonic(asUint8Array, wordlist);

        return phrase;
    }
};
