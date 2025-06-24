import { Crypto } from './crypto';
import { timestamp } from './date';

/**
 * Class representing an OAuth state, including code verifier and nonce for PKCE flows.
 */
export class State {
	/**
	 * The unique identifier for the state.
	 * @type {string}
	 */
	id!: string;

	/**
	 * The timestamp when the state was created, represented in seconds since the epoch.
	 * @type {number}
	 */
	createdAt!: number;

	/**
	 * The code verifier used in the PKCE (Proof Key for Code Exchange) flow.
	 * @type {string}
	 */
	codeVerifier!: string;

	/**
	 * The code challenge derived from the code verifier for the PKCE flow.
	 * @type {string}
	 */
	codeChallenge!: string;

	/**
	 * The nonce value used to associate a client session with an ID token for replay protection.
	 * @type {string}
	 */
	nonce!: string;

	/**
	 * Creates a new instance of `State` with generated values for PKCE and nonce.
	 *
	 * @returns {Promise<State>} A promise that resolves to a new `State` instance.
	 */
	static async create(): Promise<State> {
		const instance = new State();

		instance.id = Crypto.generateState();
		instance.createdAt = timestamp();
		instance.codeVerifier = Crypto.generateCodeVerifier();
		instance.codeChallenge = await Crypto.generateCodeChallenge(instance.codeVerifier);
		instance.nonce = Crypto.generateNonce();

		return instance;
	}

	/**
	 * Deserializes a `State` instance from a JSON string.
	 *
	 * @param {string} serializedData The serialized state data as a JSON string.
	 * @returns {State} A new `State` instance populated with the deserialized data.
	 */
	static fromSerializedData(serializedData: string): State {
		const instance = new State();
		const data = JSON.parse(serializedData);

		instance.id = data.id;
		instance.createdAt = data.createdAt;
		instance.codeVerifier = data.codeVerifier;
		instance.codeChallenge = data.codeChallenge;
		instance.nonce = data.nonce;

		return instance;
	}
}
