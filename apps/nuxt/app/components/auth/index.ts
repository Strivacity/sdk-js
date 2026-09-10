import type { Component } from 'vue';
import { getExtraParams } from '@strivacity/common/utils/oidc';
import RedirectLogin from './redirect/RedirectLogin.vue';
import PopupLogin from './popup/PopupLogin.vue';
import EmbeddedLogin from './embedded/EmbeddedLogin.vue';
import NativeLogin from './native/NativeLogin.vue';

// This demo shows all supported modes side by side
// In your own app, pick the single mode you use and drop the rest
const mode = import.meta.env.VITE_MODE ?? 'redirect';
const modes: Record<string, Component> = {
	redirect: RedirectLogin,
	popup: PopupLogin,
	embedded: EmbeddedLogin,
	native: NativeLogin,
};

export const extraParams = getExtraParams();
export const component = modes[mode];
