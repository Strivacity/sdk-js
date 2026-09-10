import type { Component } from 'solid-js';
import { extraParams } from '../../options';
import RedirectLogin from './redirect/RedirectLogin';
import PopupLogin from './popup/PopupLogin';
import EmbeddedLogin from './embedded/EmbeddedLogin';
import NativeLogin from './native/NativeLogin';

// This demo shows all supported modes side by side
// In your own app, pick the single mode you use and drop the rest
export { extraParams };

export const modes: Record<string, Component<{ flowType: 'login' | 'register' }>> = {
	redirect: RedirectLogin,
	popup: PopupLogin,
	embedded: EmbeddedLogin,
	native: NativeLogin,
};
