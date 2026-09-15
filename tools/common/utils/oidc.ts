import type { ExtraRequestArgs } from '@strivacity/sdk-core/types';

declare const process: { env?: Record<string, string | undefined> } | undefined;

export function getExtraParams(extraArgs?: ExtraRequestArgs): ExtraRequestArgs {
	const env = typeof process !== 'undefined' ? process?.env : undefined;

	return {
		loginHint: import.meta.env?.VITE_LOGIN_HINT ?? env?.LOGIN_HINT,
		acrValues: import.meta.env?.VITE_ACR_VALUES?.split(' ') ?? env?.ACR_VALUES?.split(' '),
		audiences: import.meta.env?.VITE_AUDIENCES?.split(' ') ?? env?.AUDIENCES?.split(' '),
		...extraArgs,
	};
}
