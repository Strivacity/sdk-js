import type { ExtraRequestArgs } from '@strivacity/sdk-core/types';

export function getExtraParams(extraArgs?: ExtraRequestArgs): ExtraRequestArgs {
	return {
		loginHint: import.meta.env?.VITE_LOGIN_HINT ?? process?.env?.LOGIN_HINT,
		acrValues: import.meta.env?.VITE_ACR_VALUES?.split(' ') ?? process?.env?.ACR_VALUES?.split(' '),
		audiences: import.meta.env?.VITE_AUDIENCES?.split(' ') ?? process?.env?.AUDIENCES?.split(' '),
		...extraArgs,
	};
}
