import 'vitest-fetch-mock';
import AnonymousIdentity from './anonymousIdentity';

describe('anonymousIdentity', () => {
	afterEach(() => {
		fetchMock.resetMocks();
	});

	describe('init', () => {
		it('should use default timeout', () => {
			const anonymousIdentity = new AnonymousIdentity({ url: 'https://test.com' });

			expect(typeof anonymousIdentity.consent).not.toBeUndefined();
			// @ts-ignore
			expect(anonymousIdentity.timeout).toBe(30000);
			// @ts-ignore
			expect(anonymousIdentity.url).toBe('https://test.com');
		});

		describe('w/ custom timeout', () => {
			const anonymousIdentity = new AnonymousIdentity({ timeout: 25000, url: 'https://test.com' });
			const attributes = {
				familyName: 'George',
				givenName: 'Lord',
				email: 'test@test.com',
			};
			const mockResponse = {
				id: 'testId',
				createdAt: '2020-08-18T10:39:22.104464029Z',
				attributes: attributes,
			};

			it('should use custom timeout', () => {
				// @ts-ignore
				expect(anonymousIdentity.timeout).toBe(25000);
				// @ts-ignore
				expect(anonymousIdentity.url).toBe('https://test.com');
			});

			describe('createIdentity', () => {
				it('should return new identity', async () => {
					const request = fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

					const response = await anonymousIdentity.createIdentity(attributes);

					expect(request).toHaveBeenCalledWith('https://test.com/api/v1/identities', {
						body: JSON.stringify(attributes),
						headers: {
							'Content-Type': 'application/json',
						},
						method: 'POST',
						signal: expect.anything(),
					});
					expect(response.id).toEqual(mockResponse.id);
				});

				it('should return 400', async () => {
					const request = fetchMock.mockResponseOnce('', { status: 400 });

					try {
						await anonymousIdentity.createIdentity(attributes);

						expect(request).toHaveBeenCalledWith('https://test.com/api/v1/identities', {
							body: JSON.stringify(attributes),
							headers: {
								'Content-Type': 'application/json',
							},
							method: 'POST',
							signal: expect.anything(),
						});
					} catch (e: any) {
						expect(e.code).toBe(400);
						expect(e.message).toBe('Bad Request');
						return;
					}

					expect('Promise not rejected for 404').toBe(false);
				});

				describe('should use custom timeout', () => {
					it('should return in time', async () => {
						fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

						vi.useFakeTimers();

						const promise = anonymousIdentity.createIdentity(attributes);

						vi.advanceTimersByTime(24999);

						const response = await promise;

						expect(response.id).toEqual(mockResponse.id);
					});

					it('should return timeout error', async () => {
						fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

						vi.useFakeTimers();

						try {
							const promise = anonymousIdentity.createIdentity(attributes);

							vi.advanceTimersByTime(25000);

							await promise;
						} catch (e: any) {
							expect(e.toString()).toBe(`Error: Timeout (25000ms) when executing 'fetch'`);
							return;
						}

						// Note: should fail if timeout isn't working
						expect('Timeout not occurred').toBe(false);
					});
				});
			});

			describe('checkIdentityById', () => {
				it('should return ok', async () => {
					const request = fetchMock.mockResponseOnce('');

					await anonymousIdentity.checkIdentityById('testId');

					expect(request).toHaveBeenCalledWith('https://test.com/api/v1/identities/testId', {
						headers: {
							'Content-Type': 'application/json',
						},
						method: 'HEAD',
						signal: expect.anything(),
					});
				});

				it('should return 404', async () => {
					const request = fetchMock.mockResponseOnce('', { status: 404 });

					try {
						await anonymousIdentity.checkIdentityById('testId');

						expect(request).toHaveBeenCalledWith('https://test.com/api/v1/identities/testId', {
							headers: {
								'Content-Type': 'application/json',
							},
							method: 'HEAD',
							signal: expect.anything(),
						});
					} catch (e: any) {
						expect(e.code).toBe(404);
						expect(e.message).toBe('Not Found');
						return;
					}

					expect('Promise not rejected for 404').toBe(false);
				});

				it('should not call HEAD request - missing id', async () => {
					const request = fetchMock.mockResponseOnce('');

					try {
						await anonymousIdentity.checkIdentityById('');
						expect('Should throw forward').toBe(false);
					} catch (e: any) {
						expect(request).not.toHaveBeenCalled();
						expect(e.toString()).toEqual('Error: checkIdentityById :: id must be provided');
					}
				});
			});

			describe('getIdentityById', () => {
				it('should return ok', async () => {
					const request = fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

					const response = await anonymousIdentity.getIdentityById('testId', 'sessionCookie');

					expect(request).toHaveBeenCalledWith('https://test.com/api/v1/identities/testId', {
						headers: {
							'Content-Type': 'application/json',
							'X-SESSION': 'sessionCookie',
						},
						method: 'GET',
						signal: expect.anything(),
					});
					expect(response.id).toEqual(mockResponse.id);
				});

				it('should return 404', async () => {
					const request = fetchMock.mockResponseOnce('', { status: 404 });

					try {
						await anonymousIdentity.getIdentityById('testId', 'sessionCookie');

						expect(request).toHaveBeenCalledWith('https://test.com/api/v1/identities/testId', {
							headers: {
								'Content-Type': 'application/json',
								'X-SESSION': 'sessionCookie',
							},
							method: 'GET',
							signal: expect.anything(),
						});
					} catch (e: any) {
						expect(e.code).toBe(404);
						expect(e.message).toBe('Not Found');
						return;
					}

					expect('Promise not rejected for 404').toBe(false);
				});

				it('should not call GET request - missing id', async () => {
					const request = fetchMock.mockResponseOnce('');

					try {
						await anonymousIdentity.getIdentityById('', 'sessionId');
						expect('Should throw forward').toBe(false);
					} catch (e: any) {
						expect(request).not.toHaveBeenCalled();
						expect(e.toString()).toEqual('Error: getIdentityById :: id must be provided');
					}
				});

				it('should not call GET request - missing session', async () => {
					const request = fetchMock.mockResponseOnce('');

					try {
						await anonymousIdentity.getIdentityById('testId', '');
						expect('Should throw forward').toBe(false);
					} catch (e: any) {
						expect(request).not.toHaveBeenCalled();
						expect(e.toString()).toEqual('Error: getIdentityById :: session must be provided');
					}
				});
			});

			describe('deleteIdentityById', () => {
				it('should return ok', async () => {
					const request = fetchMock.mockResponseOnce('');

					await anonymousIdentity.deleteIdentityById('testId');

					expect(request).toHaveBeenCalledWith('https://test.com/api/v1/identities/testId', {
						headers: {
							'Content-Type': 'application/json',
						},
						method: 'DELETE',
						signal: expect.anything(),
					});
				});

				it('should not call DELETE request - missing id', async () => {
					const request = fetchMock.mockResponseOnce('');

					try {
						await anonymousIdentity.deleteIdentityById('');
						expect('Should throw forward').toBe(false);
					} catch (e: any) {
						expect(request).not.toHaveBeenCalled();
						expect(e.toString()).toEqual('Error: deleteIdentityById :: id must be provided');
					}
				});
			});
		});
	});
});
