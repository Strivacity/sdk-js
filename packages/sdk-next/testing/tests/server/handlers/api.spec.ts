import type { Mock } from 'vitest';
import { describe, test, expect, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { createMockBaseServerSDK } from '@strivacity/testing/mocks/sdk';
import { apiAppRouteHandlerFactory, apiPageRouteHandlerFactory } from '../../../../src/server/handlers/api';
import type { BaseServerSDK, PagesRouterRequest } from '../../../../src/server/types';

describe('apiAppRouteHandlerFactory', () => {
	test('returns a 401 response and does not call the route when there is no session', async () => {
		const sdk = createMockBaseServerSDK<BaseServerSDK<NextRequest | Request | PagesRouterRequest | undefined>>();
		const apiRoute = vi.fn();
		const handler = apiAppRouteHandlerFactory(sdk)(apiRoute);

		const response = await handler(new NextRequest('https://brandtegrity.io/api/secret'), {});

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({
			error: 'not_authenticated',
			description: 'The user does not have an active session or is not authenticated',
		});
		expect(apiRoute).not.toHaveBeenCalled();
	});

	test('calls the route with the request and params when there is a session', async () => {
		const sdk = createMockBaseServerSDK<BaseServerSDK<NextRequest | Request | PagesRouterRequest | undefined>>({ getSession: vi.fn().mockResolvedValue({}) });
		const apiRoute = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
		const handler = apiAppRouteHandlerFactory(sdk)(apiRoute);
		const req = new NextRequest('https://brandtegrity.io/api/secret');
		const params = { params: Promise.resolve({ id: '1' }) };

		await handler(req, params);

		expect(apiRoute).toHaveBeenCalledWith(req, params);
		expect(sdk.getSession).toHaveBeenCalledWith(req);
	});

	test('returns the route NextResponse unchanged', async () => {
		const sdk = createMockBaseServerSDK<BaseServerSDK<NextRequest | Request | PagesRouterRequest | undefined>>({ getSession: vi.fn().mockResolvedValue({}) });
		const routeResponse = NextResponse.json({ ok: true });
		const apiRoute = vi.fn().mockResolvedValue(routeResponse);
		const handler = apiAppRouteHandlerFactory(sdk)(apiRoute);

		const response = await handler(new NextRequest('https://brandtegrity.io/api/secret'), {});

		expect(response).toBe(routeResponse);
	});

	test('wraps a plain Response returned by the route into a NextResponse', async () => {
		const sdk = createMockBaseServerSDK<BaseServerSDK<NextRequest | Request | PagesRouterRequest | undefined>>({ getSession: vi.fn().mockResolvedValue({}) });
		const apiRoute = vi.fn().mockResolvedValue(new Response('plain body', { status: 201, headers: { 'x-custom': 'yes' } }));
		const handler = apiAppRouteHandlerFactory(sdk)(apiRoute);

		const response = await handler(new NextRequest('https://brandtegrity.io/api/secret'), {});

		expect(response).toBeInstanceOf(NextResponse);
		expect(response.status).toBe(201);
		expect(response.headers.get('x-custom')).toBe('yes');
		await expect(response.text()).resolves.toBe('plain body');
	});

	test('converts a plain Request to a NextRequest before checking the session and calling the route', async () => {
		const sdk = createMockBaseServerSDK<BaseServerSDK<NextRequest | Request | PagesRouterRequest | undefined>>({ getSession: vi.fn().mockResolvedValue({}) });
		const apiRoute = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
		const handler = apiAppRouteHandlerFactory(sdk)(apiRoute);
		const req = new Request('https://brandtegrity.io/api/secret');

		await handler(req, {});

		const usedRequest = (sdk.getSession as Mock).mock.calls[0][0] as NextRequest;
		expect(usedRequest).toBeInstanceOf(NextRequest);
		expect(usedRequest.url).toBe(req.url);
		expect(apiRoute).toHaveBeenCalledWith(usedRequest, {});
	});
});

describe('apiPageRouteHandlerFactory', () => {
	function createFakeRes() {
		const json = vi.fn();
		const status = vi.fn().mockReturnValue({ json });

		return { status, json };
	}

	test('responds with 401 and does not call the route when there is no session', async () => {
		const sdk = createMockBaseServerSDK<BaseServerSDK<NextRequest | Request | PagesRouterRequest | undefined>>();
		const apiRoute = vi.fn();
		const handler = apiPageRouteHandlerFactory(sdk)(apiRoute);
		const req = {} as PagesRouterRequest;
		const res = createFakeRes();

		await handler(req, res as never);

		expect(res.status).toHaveBeenCalledWith(401);
		expect(res.json).toHaveBeenCalledWith({ error: 'not_authenticated', description: 'The user does not have an active session or is not authenticated' });
		expect(apiRoute).not.toHaveBeenCalled();
	});

	test('calls the route with the request and response when there is a session', async () => {
		const sdk = createMockBaseServerSDK<BaseServerSDK<NextRequest | Request | PagesRouterRequest | undefined>>({ getSession: vi.fn().mockResolvedValue({}) });
		const apiRoute = vi.fn();
		const handler = apiPageRouteHandlerFactory(sdk)(apiRoute);
		const req = {} as PagesRouterRequest;
		const res = createFakeRes();

		await handler(req, res as never);

		expect(apiRoute).toHaveBeenCalledWith(req, res);
		expect(res.status).not.toHaveBeenCalled();
	});
});
