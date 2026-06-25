import type { StateData } from '../types/oidc';
import { timestamp } from './common';
import { generateCodeVerifier, generateCodeChallenge, generateRandomHex } from './oidc';

/**
 * Creates a new state object for OAuth 2.0 authorization requests, including a code verifier and challenge for PKCE.
 *
 * @returns {Promise<StateData>} A promise that resolves to the newly created state object.
 */
export async function createState(): Promise<StateData> {
	const codeVerifier = generateCodeVerifier();

	return {
		id: generateRandomHex(16),
		createdAt: timestamp(),
		codeVerifier,
		codeChallenge: await generateCodeChallenge(codeVerifier),
		nonce: generateRandomHex(16),
	};
}

/**
 * Parses a serialized state string into a StateData object.
 *
 * @param {string} serialized - The serialized state string to parse.
 * @returns {StateData} The parsed StateData object.
 * @throws {Error} If the serialized string is invalid or cannot be parsed.
 */
export function parseState(serialized: string): StateData {
	return JSON.parse(serialized) as StateData;
}

/**
 * Serializes a StateData object into a string for storage or transmission.
 *
 * @param {StateData} state - The StateData object to serialize.
 * @returns {string} The serialized state string.
 */
export function serializeState(state: StateData): string {
	return JSON.stringify(state);
}
