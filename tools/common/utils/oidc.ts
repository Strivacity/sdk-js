import type { ExtraRequestArgs } from '@strivacity/sdk-core/types';

export function getExtraParams(extraArgs?: ExtraRequestArgs): ExtraRequestArgs {
	return {
		loginHint: import.meta.env?.VITE_LOGIN_HINT,
		acrValues: import.meta.env?.VITE_ACR_VALUES?.split(' '),
		audiences: import.meta.env?.VITE_AUDIENCES?.split(' '),
		...extraArgs,
	};
}
