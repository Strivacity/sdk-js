import type { SessionData } from '@strivacity/sdk-solid/client';
import { getServerSdk } from './strivacity';

export async function getSession(): Promise<SessionData | null> {
	'use server';

	return await getServerSdk().getSession();
}
