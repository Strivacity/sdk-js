import { Crypto } from './utils/crypto';
import { timestamp } from './utils/date';

export class State {
	id!: string;
	createdAt!: number;
	codeVerifier!: string;
	codeChallenge!: string;
	nonce!: string;

	static async create(): Promise<State> {
		const instance = new State();

		instance.id = Crypto.generateState();
		instance.createdAt = timestamp();
		instance.codeVerifier = Crypto.generateCodeVerifier();
		instance.codeChallenge = await Crypto.generateCodeChallenge(instance.codeVerifier);
		instance.nonce = Crypto.generateNonce();

		return instance as State;
	}

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
