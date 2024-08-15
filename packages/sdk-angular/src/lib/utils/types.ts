import type { IdTokenClaims } from '@strivacity/sdk-core';

export type Session = {
	loading: boolean;
	isAuthenticated: boolean;
	idTokenClaims: IdTokenClaims | null;
	accessToken: string | null;
	refreshToken: string | null;
	accessTokenExpired: boolean;
	accessTokenExpirationDate: number | null;
};
