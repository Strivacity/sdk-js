import type { H3Event } from 'h3';
import { test, expect, vi } from 'vitest';
import loginHandler from '../../../src/runtime/server/api/auth/login.get';
import registerHandler from '../../../src/runtime/server/api/auth/register.get';
import callbackHandler from '../../../src/runtime/server/api/auth/callback.get';
import refreshHandler from '../../../src/runtime/server/api/auth/refresh.get';
import revokeHandler from '../../../src/runtime/server/api/auth/revoke.get';
import entryHandler from '../../../src/runtime/server/api/auth/entry.get';
import logoutHandler from '../../../src/runtime/server/api/auth/logout.get';
import backchannelLogoutHandler from '../../../src/runtime/server/api/auth/backchannel-logout.get';

function createFakeEvent(sdk: Record<string, ReturnType<typeof vi.fn>>): H3Event {
	return { context: { strivacity: { sdk } } } as unknown as H3Event;
}

test.each([
	['login.get', loginHandler, 'handleLogin'],
	['register.get', registerHandler, 'handleRegister'],
	['callback.get', callbackHandler, 'handleCallback'],
	['refresh.get', refreshHandler, 'handleRefresh'],
	['revoke.get', revokeHandler, 'handleRevoke'],
	['entry.get', entryHandler, 'handleEntry'],
	['logout.get', logoutHandler, 'handleLogout'],
	['backchannel-logout.get', backchannelLogoutHandler, 'handleBackChannelLogout'],
] as const)('%s dispatches to sdk.%s with the event', async (_name, handler, sdkMethod) => {
	const response = new Response(null, { status: 204 });
	const sdk = { [sdkMethod]: vi.fn().mockResolvedValue(response) };
	const event = createFakeEvent(sdk);

	const result = await handler(event);

	expect(sdk[sdkMethod]).toHaveBeenCalledWith(event);
	expect(result).toBe(response);
});
