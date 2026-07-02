import { sdk } from './app/lib/auth/server';

export const proxy = sdk.middleware;

export const config = {
	matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
