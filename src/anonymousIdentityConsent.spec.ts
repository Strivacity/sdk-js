/* eslint-disable @typescript-eslint/ban-ts-comment */
import fetchMock, { enableFetchMocks } from 'jest-fetch-mock';
import AnonymousIdentityConsent from './anonymousIdentityConsent';

enableFetchMocks();

describe('anonymousIdentityConsent', () => {
	const identityId = 'testIdentityId';

	afterEach(() => {
		fetchMock.resetMocks();
	});

	describe('init', () => {
		it('should use default timeout', () => {
			const anonymousIdentityConsent = new AnonymousIdentityConsent({ url: 'https://test.com' });

			// @ts-ignore
			expect(anonymousIdentityConsent.timeout).toBe(30000);
			// @ts-ignore
			expect(anonymousIdentityConsent.url).toBe('https://test.com');
		});

		describe('w/ custom timeout', () => {
			const anonymousIdentityConsent = new AnonymousIdentityConsent({ timeout: 25000, url: 'https://test.com' });
			const consentRequest = {
				format: 'iab',
				iab: {
					receipt: 'BOEFEAyOEFEAyAHABDENAI4AAAB9vABAASA',
				},
			};
			const mockResponse = {
				id: 'testId',
				createdAt: '2020-08-18T10:39:22.104464029Z',
				...consentRequest,
			};

			it('should use custom timeout', () => {
				// @ts-ignore
				expect(anonymousIdentityConsent.timeout).toBe(25000);
				// @ts-ignore
				expect(anonymousIdentityConsent.url).toBe('https://test.com');
			});

			describe('getConsents', () => {
				it('should return consents array', async () => {
					const request = fetchMock.mockResponseOnce(JSON.stringify([mockResponse]));

					const response = await anonymousIdentityConsent.getConsents(identityId, 'sessionCookie');

					expect(request).toHaveBeenCalledWith(
						'https://test.com/api/v1/identities/testIdentityId/consents',
						{
							headers: {
								'Content-Type': 'application/json',
								'X-SESSION': 'sessionCookie',
							},
							method: 'GET',
							signal: expect.anything(),
						},
					);
					expect(response[0].id).toEqual(mockResponse.id);
				});

				it('should return 404', async () => {
					const request = fetchMock.mockResponseOnce('', { status: 404 });

					try {
						await anonymousIdentityConsent.getConsents(identityId, 'sessionCookie');

						expect(request).toHaveBeenCalledWith(
							'https://test.com/api/v1/identities/testIdentityId/consents',
							{
								headers: {
									'Content-Type': 'application/json',
									'X-SESSION': 'sessionCookie',
								},
								method: 'GET',
								signal: expect.anything(),
							},
						);
					} catch (e) {
						expect(e.code).toBe(404);
						expect(e.message).toBe('Not Found');
						return;
					}

					expect('Promise not rejected for 404').toBe(false);

				});

				it('should not call GET request - missing identityId', async () => {
					const request = fetchMock.mockResponseOnce('');

					try {
						await anonymousIdentityConsent.getConsents('', 'sessionId');
						expect('Should throw forward').toBe(false);
					} catch (e) {
						expect(request).not.toHaveBeenCalled();
						expect(e.toString()).toEqual('Error: getConsents :: identityId must be provided');
					}
				});

				it('should not call GET request - missing session', async () => {
					const request = fetchMock.mockResponseOnce('');

					try {
						await anonymousIdentityConsent.getConsents(identityId, '');
						expect('Should throw forward').toBe(false);
					} catch (e) {
						expect(request).not.toHaveBeenCalled();
						expect(e.toString()).toEqual('Error: getConsents :: session must be provided');
					}
				});
			});

			describe('createConsent', () => {
				it('should return new consent', async () => {
					const request = fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

					const response = await anonymousIdentityConsent.createConsent(identityId, consentRequest);

					expect(request).toHaveBeenCalledWith(
						'https://test.com/api/v1/identities/testIdentityId/consents',
						{
							body: JSON.stringify(consentRequest),
							headers: {
								'Content-Type': 'application/json',
							},
							method: 'POST',
							signal: expect.anything(),
						},
					);
					expect(response.id).toEqual(mockResponse.id);
				});

				it('should return 400', async () => {
					const request = fetchMock.mockResponseOnce('', { status: 400 });

					try {
						await anonymousIdentityConsent.createConsent(identityId, consentRequest);

						expect(request).toHaveBeenCalledWith(
							'https://test.com/api/v1/identities/testIdentityId/consents',
							{
								body: JSON.stringify(consentRequest),
								headers: {
									'Content-Type': 'application/json',
								},
								method: 'POST',
								signal: expect.anything(),
							},
						);
					} catch (e) {
						expect(e.code).toBe(400);
						expect(e.message).toBe('Bad Request');
						return;
					}

					expect('Promise not rejected for 404').toBe(false);
				});

				it('should not call POST request - missing identityId', async () => {
					const request = fetchMock.mockResponseOnce('');

					try {
						await anonymousIdentityConsent.createConsent('', consentRequest);
						expect('Should throw forward').toBe(false);
					} catch (e) {
						expect(request).not.toHaveBeenCalled();
						expect(e.toString()).toEqual('Error: createConsent :: identityId must be provided');
					}
				});

				describe('should use custom timeout', () => {
					it('should return in time', async () => {
						fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

						jest.useFakeTimers();

						const promise = anonymousIdentityConsent.createConsent(identityId, consentRequest);

						jest.advanceTimersByTime(24999);

						const response = await promise;

						expect(response.id).toEqual(mockResponse.id);
					});

					it('should return timeout error', async () => {
						fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

						jest.useFakeTimers();

						try {
							const promise = anonymousIdentityConsent.createConsent(identityId, consentRequest);

							jest.advanceTimersByTime(25000);

							await promise;
						} catch (e) {
							expect(e.toString()).toBe(`Error: Timeout (25000ms) when executing 'fetch'`);
							return;
						}

						// Note: should fail if timeout isn't working
						expect('Timeout not occurred').toBe(false);
					});
				});
			});

			describe('checkConsentById', () => {
				it('should return ok', async () => {
					const request = fetchMock.mockResponseOnce('');

					await anonymousIdentityConsent.checkConsentById(identityId, 'testId');

					expect(request).toHaveBeenCalledWith(
						'https://test.com/api/v1/identities/testIdentityId/consents/testId',
						{
							headers: {
								'Content-Type': 'application/json',
							},
							method: 'HEAD',
							signal: expect.anything(),
						},
					);
				});

				it('should return 404', async () => {
					const request = fetchMock.mockResponseOnce('', { status: 404 });

					try {
						await anonymousIdentityConsent.checkConsentById(identityId, 'testId');

						expect(request).toHaveBeenCalledWith(
							'https://test.com/api/v1/identities/testIdentityId/consents/testId',
							{
								headers: {
									'Content-Type': 'application/json',
								},
								method: 'HEAD',
								signal: expect.anything(),
							},
						);
					} catch (e) {
						expect(e.code).toBe(404);
						expect(e.message).toBe('Not Found');
						return;
					}

					expect('Promise not rejected for 404').toBe(false);
				});

				it('should not call HEAD request - missing identityId', async () => {
					const request = fetchMock.mockResponseOnce('');

					try {
						await anonymousIdentityConsent.checkConsentById('', 'testId');
						expect('Should throw forward').toBe(false);
					} catch (e) {
						expect(request).not.toHaveBeenCalled();
						expect(e.toString()).toEqual('Error: checkConsentById :: identityId must be provided');
					}
				});

				it('should not call HEAD request - missing id', async () => {
					const request = fetchMock.mockResponseOnce('');

					try {
						await anonymousIdentityConsent.checkConsentById(identityId, '');
						expect('Should throw forward').toBe(false);
					} catch (e) {
						expect(request).not.toHaveBeenCalled();
						expect(e.toString()).toEqual('Error: checkConsentById :: id must be provided');
					}
				});
			});

			describe('getConsentById', () => {
				it('should return ok', async () => {
					const request = fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

					const response = await anonymousIdentityConsent.getConsentById(identityId, 'testId', 'sessionCookie');

					expect(request).toHaveBeenCalledWith(
						'https://test.com/api/v1/identities/testIdentityId/consents/testId',
						{
							headers: {
								'Content-Type': 'application/json',
								'X-SESSION': 'sessionCookie',
							},
							method: 'GET',
							signal: expect.anything(),
						},
					);
					expect(response.id).toEqual(mockResponse.id);
				});

				it('should return 404', async () => {
					const request = fetchMock.mockResponseOnce('', { status: 404 });

					try {
						await anonymousIdentityConsent.getConsentById(identityId, 'testId', 'sessionCookie');

						expect(request).toHaveBeenCalledWith(
							'https://test.com/api/v1/identities/testIdentityId/consents/testId',
							{
								headers: {
									'Content-Type': 'application/json',
									'X-SESSION': 'sessionCookie',
								},
								method: 'GET',
								signal: expect.anything(),
							},
						);
					} catch (e) {
						expect(e.code).toBe(404);
						expect(e.message).toBe('Not Found');
						return;
					}

					expect('Promise not rejected for 404').toBe(false);
				});

				it('should not call GET request - missing identityId', async () => {
					const request = fetchMock.mockResponseOnce('');

					try {
						await anonymousIdentityConsent.getConsentById('', '', 'sessionId');
						expect('Should throw forward').toBe(false);
					} catch (e) {
						expect(request).not.toHaveBeenCalled();
						expect(e.toString()).toEqual('Error: getConsentById :: identityId must be provided');
					}
				});

				it('should not call GET request - missing id', async () => {
					const request = fetchMock.mockResponseOnce('');

					try {
						await anonymousIdentityConsent.getConsentById(identityId, '', 'sessionId');
						expect('Should throw forward').toBe(false);
					} catch (e) {
						expect(request).not.toHaveBeenCalled();
						expect(e.toString()).toEqual('Error: getConsentById :: id must be provided');
					}
				});

				it('should not call GET request - missing session', async () => {
					const request = fetchMock.mockResponseOnce('');

					try {
						await anonymousIdentityConsent.getConsentById(identityId, 'testId', '');
						expect('Should throw forward').toBe(false);
					} catch (e) {
						expect(request).not.toHaveBeenCalled();
						expect(e.toString()).toEqual('Error: getConsentById :: session must be provided');
					}
				});
			});

			describe('deleteConsentById', () => {
				it('should return ok', async () => {
					const request = fetchMock.mockResponseOnce('', { status: 204 });

					await anonymousIdentityConsent.deleteConsentById(identityId, 'testId');

					expect(request).toHaveBeenCalledWith(
						'https://test.com/api/v1/identities/testIdentityId/consents/testId',
						{
							headers: {
								'Content-Type': 'application/json',
							},
							method: 'DELETE',
							signal: expect.anything(),
						},
					);
				});

				it('should not call DELETE request - missing identityId', async () => {
					const request = fetchMock.mockResponseOnce('');

					try {
						await anonymousIdentityConsent.deleteConsentById('', 'testId');
						expect('Should throw forward').toBe(false);
					} catch (e) {
						expect(request).not.toHaveBeenCalled();
						expect(e.toString()).toEqual('Error: deleteConsentById :: identityId must be provided');
					}
				});

				it('should not call DELETE request - missing id', async () => {
					const request = fetchMock.mockResponseOnce('');

					try {
						await anonymousIdentityConsent.deleteConsentById(identityId, '');
						expect('Should throw forward').toBe(false);
					} catch (e) {
						expect(request).not.toHaveBeenCalled();
						expect(e.toString()).toEqual('Error: deleteConsentById :: id must be provided');
					}
				});
			});
		});

	});
});
