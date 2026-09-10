import type { Component as SvelteComponent } from 'svelte';
import { getExtraParams } from '@strivacity/common/utils/oidc';
import RedirectLogin from './redirect/RedirectLogin.svelte';
import PopupLogin from './popup/PopupLogin.svelte';
import EmbeddedLogin from './embedded/EmbeddedLogin.svelte';
import NativeLogin from './native/NativeLogin.svelte';

// This demo shows all supported modes side by side
// In your own app, pick the single mode you use and drop the rest
const mode = import.meta.env.VITE_MODE ?? 'redirect';
const modes: Record<string, SvelteComponent<{ flowType: 'login' | 'register' }>> = {
	redirect: RedirectLogin,
	popup: PopupLogin,
	embedded: EmbeddedLogin,
	native: NativeLogin,
};

export const extraParams = getExtraParams();
export const Component = modes[mode];
