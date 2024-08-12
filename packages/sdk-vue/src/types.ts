import type { Ref } from 'vue';
import type { IdTokenClaims } from '@strivacity/sdk-core';
import type { PopupFlow } from '@strivacity/sdk-core/flows/PopupFlow';
import type { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';

export type Session = {
	loading: Ref<boolean>;
	isAuthenticated: Ref<boolean>;
	idTokenClaims: Ref<IdTokenClaims | null>;
	accessToken: Ref<string | null>;
	refreshToken: Ref<string | null>;
	accessTokenExpired: Ref<boolean>;
	accessTokenExpirationDate: Ref<number | null>;
};

export type PopupSDK = {
	login: InstanceType<typeof PopupFlow>['login'];
	register: InstanceType<typeof PopupFlow>['register'];
	refresh: InstanceType<typeof PopupFlow>['refresh'];
	revoke: InstanceType<typeof PopupFlow>['revoke'];
	logout: InstanceType<typeof PopupFlow>['logout'];
	handleCallback: InstanceType<typeof PopupFlow>['handleCallback'];
};

export type RedirectSDK = {
	login: InstanceType<typeof RedirectFlow>['login'];
	register: InstanceType<typeof RedirectFlow>['register'];
	refresh: InstanceType<typeof RedirectFlow>['refresh'];
	revoke: InstanceType<typeof RedirectFlow>['revoke'];
	logout: InstanceType<typeof RedirectFlow>['logout'];
	handleCallback: InstanceType<typeof RedirectFlow>['handleCallback'];
};

export type PopupContext = PopupSDK & Session;
export type RedirectContext = RedirectSDK & Session;
