import type { ComponentType } from 'react';
import { getExtraParams } from '@strivacity/common/utils/oidc';
import RedirectLogin from './redirect/RedirectLogin';
import PopupLogin from './popup/PopupLogin';
import EmbeddedLogin from './embedded/EmbeddedLogin';
import NativeLogin from './native/NativeLogin';

// This demo shows all supported modes side by side
// In your own app, pick the single mode you use and drop the rest
const mode = import.meta.env.VITE_MODE ?? 'redirect';
const modes: Record<string, ComponentType<{ flowType: 'login' | 'register' }>> = {
	redirect: RedirectLogin,
	popup: PopupLogin,
	embedded: EmbeddedLogin,
	native: NativeLogin,
};

export const extraParams = getExtraParams();

export const Component = modes[mode];
