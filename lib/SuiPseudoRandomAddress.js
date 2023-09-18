const { entropyToMnemonic } = require('@scure/bip39');
const { wordlist } = require('@scure/bip39/wordlists/english');
const { Ed25519Keypair } = require('@mysten/sui.js/keypairs/ed25519');

class SuiPseudoRandomAddress {
    static stringToKeyPair(as) {
        const pseudoRandomPhrase = SuiPseudoRandomAddress.stringToPhrase(as);
        return Ed25519Keypair.deriveKeypair(pseudoRandomPhrase);
    }

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
        const asUint8Array = new Uint8Array(32); // see .slice(0,32) below
        asUint8Array.set(asBytes.slice(0,32));
        // console.log(asUint8Array);
        // use @scure/bip39 to get mnemonic out of pseudo-random array:
        const phrase = entropyToMnemonic(asUint8Array, wordlist);

        return phrase;
    }
};

module.exports = SuiPseudoRandomAddress;