import { describe, test, expect } from 'vitest';
import { State } from '../../src/utils/State';

describe('State', () => {
	test('create', async () => {
		const state = await State.create();

		expect(state.id).toBeTypeOf('string');
		expect(state.createdAt).toBeTypeOf('number');
		expect(state.codeVerifier).toBeTypeOf('string');
		expect(state.codeChallenge).toBeTypeOf('string');
		expect(state.nonce).toBeTypeOf('string');
	});

	test('fromSerializedData', async () => {
		const serializedData = await State.create();
		const state = State.fromSerializedData(JSON.stringify(serializedData));

		expect(state.id).toEqual(serializedData.id);
		expect(state.createdAt).toEqual(serializedData.createdAt);
		expect(state.codeVerifier).toEqual(serializedData.codeVerifier);
		expect(state.codeChallenge).toEqual(serializedData.codeChallenge);
		expect(state.nonce).toEqual(serializedData.nonce);
	});
});
