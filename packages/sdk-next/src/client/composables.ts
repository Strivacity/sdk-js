import type { EmbeddedFlow, initFlow, NativeFlow, PopupFlow, RedirectFlow } from '@strivacity/sdk-core';
import { createContext, useContext } from 'react';

export const STRIVACITY_SDK = createContext<Awaited<ReturnType<typeof initFlow>>>(null!);

/**
 * A custom hook to access the Strivacity SDK context.
 *
 * @template T - The type of the Strivacity SDK instance.
 * @returns The Strivacity SDK instance from the context.
 */
export const useStrivacity = <T extends RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow = RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow>() => {
	const context = useContext(STRIVACITY_SDK);

	if (!context) {
		throw new Error('Missing Strivacity SDK context');
	}

	return context as unknown as T;
};
