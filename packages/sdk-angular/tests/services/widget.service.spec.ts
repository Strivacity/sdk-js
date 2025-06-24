import { TestBed } from '@angular/core/testing';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { firstValueFrom } from 'rxjs';
import type { LoginFlowMessage } from '@strivacity/sdk-core';

import { StrivacityWidgetService } from '../../src/lib/services/widget.service';

describe('StrivacityWidgetService', () => {
	let service: StrivacityWidgetService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [StrivacityWidgetService],
		});

		service = TestBed.inject(StrivacityWidgetService);
	});

	describe('initialization', () => {
		test('should be created', () => {
			expect(service).toBeTruthy();
		});

		test('should initialize with default values', async () => {
			expect(await firstValueFrom(service.loading$)).toBe(false);
			expect(await firstValueFrom(service.forms$)).toEqual({});
			expect(await firstValueFrom(service.messages$)).toEqual({});
			expect(await firstValueFrom(service.state$)).toEqual({});
		});
	});

	describe('setFormValue', () => {
		test('should set form value correctly', async () => {
			const formId = 'loginForm';
			const widgetId = 'username';
			const value = 'testuser';

			service.setFormValue(formId, widgetId, value);

			const forms = await firstValueFrom(service.forms$);
			expect(forms[formId][widgetId]).toBe(value);
		});

		test('should handle multiple form values', async () => {
			const formId = 'loginForm';

			service.setFormValue(formId, 'username', 'testuser');
			service.setFormValue(formId, 'password', 'testpass');

			const forms = await firstValueFrom(service.forms$);
			expect(forms[formId]).toEqual({
				username: 'testuser',
				password: 'testpass',
			});
		});

		test('should handle multiple forms', async () => {
			service.setFormValue('loginForm', 'username', 'testuser');
			service.setFormValue('signupForm', 'email', 'test@example.com');

			const forms = await firstValueFrom(service.forms$);
			expect(forms).toEqual({
				loginForm: { username: 'testuser' },
				signupForm: { email: 'test@example.com' },
			});
		});

		test('should convert empty string to null', async () => {
			const formId = 'loginForm';
			const widgetId = 'username';

			service.setFormValue(formId, widgetId, '');

			const forms = await firstValueFrom(service.forms$);
			expect(forms[formId][widgetId]).toBeNull();
		});

		test('should update existing form values', async () => {
			const formId = 'loginForm';
			const widgetId = 'username';

			service.setFormValue(formId, widgetId, 'oldvalue');
			service.setFormValue(formId, widgetId, 'newvalue');

			const forms = await firstValueFrom(service.forms$);
			expect(forms[formId][widgetId]).toBe('newvalue');
		});

		test('should preserve other form values when updating', async () => {
			const formId = 'loginForm';

			service.setFormValue(formId, 'username', 'testuser');
			service.setFormValue(formId, 'password', 'testpass');
			service.setFormValue(formId, 'username', 'updateduser');

			const forms = await firstValueFrom(service.forms$);
			expect(forms[formId]).toEqual({
				username: 'updateduser',
				password: 'testpass',
			});
		});
	});

	describe('setMessage', () => {
		test('should set message correctly', async () => {
			const formId = 'loginForm';
			const widgetId = 'username';
			const message: LoginFlowMessage = {
				type: 'error',
				text: 'Invalid username',
			};

			service.setMessage(formId, widgetId, message);

			const messages = await firstValueFrom(service.messages$);
			expect(messages[formId][widgetId]).toEqual(message);
		});

		test('should handle multiple messages', async () => {
			const formId = 'loginForm';
			const usernameMessage: LoginFlowMessage = {
				type: 'error',
				text: 'Invalid username',
			};
			const passwordMessage: LoginFlowMessage = {
				type: 'warning',
				text: 'Weak password',
			};

			service.setMessage(formId, 'username', usernameMessage);
			service.setMessage(formId, 'password', passwordMessage);

			const messages = await firstValueFrom(service.messages$);
			expect(messages[formId]).toEqual({
				username: usernameMessage,
				password: passwordMessage,
			});
		});

		test('should handle multiple forms with messages', async () => {
			const loginMessage: LoginFlowMessage = {
				type: 'error',
				text: 'Login failed',
			};
			const signupMessage: LoginFlowMessage = {
				type: 'success',
				text: 'Account created',
			};

			service.setMessage('loginForm', 'general', loginMessage);
			service.setMessage('signupForm', 'general', signupMessage);

			const messages = await firstValueFrom(service.messages$);
			expect(messages).toEqual({
				loginForm: { general: loginMessage },
				signupForm: { general: signupMessage },
			});
		});

		test('should update existing messages', async () => {
			const formId = 'loginForm';
			const widgetId = 'username';
			const oldMessage: LoginFlowMessage = {
				type: 'error',
				text: 'Old error',
			};
			const newMessage: LoginFlowMessage = {
				type: 'success',
				text: 'New success',
			};

			service.setMessage(formId, widgetId, oldMessage);
			service.setMessage(formId, widgetId, newMessage);

			const messages = await firstValueFrom(service.messages$);
			expect(messages[formId][widgetId]).toEqual(newMessage);
		});
	});

	describe('observables', () => {
		test('should emit updated forms when setFormValue is called', async () => {
			const formId = 'testForm';
			const widgetId = 'testWidget';
			const value = 'testValue';

			expect(await firstValueFrom(service.forms$)).toEqual({});

			service.setFormValue(formId, widgetId, value);

			const forms = await firstValueFrom(service.forms$);
			expect(forms[formId][widgetId]).toBe(value);
		});

		test('should emit updated messages when setMessage is called', async () => {
			const formId = 'testForm';
			const widgetId = 'testWidget';
			const message: LoginFlowMessage = {
				type: 'info',
				text: 'Test message',
			};

			expect(await firstValueFrom(service.messages$)).toEqual({});

			service.setMessage(formId, widgetId, message);

			const messages = await firstValueFrom(service.messages$);
			expect(messages[formId][widgetId]).toEqual(message);
		});

		test('should maintain separate state for different observables', async () => {
			const initialLoading = await firstValueFrom(service.loading$);
			const initialForms = await firstValueFrom(service.forms$);
			const initialMessages = await firstValueFrom(service.messages$);
			const initialState = await firstValueFrom(service.state$);

			service.setFormValue('form1', 'widget1', 'value1');
			service.setMessage('form1', 'widget1', { type: 'error', text: 'Error' });

			const updatedLoading = await firstValueFrom(service.loading$);
			const updatedState = await firstValueFrom(service.state$);

			expect(initialLoading).toBe(updatedLoading);
			expect(initialState).toEqual(updatedState);
			expect(initialForms).toEqual({});
			expect(initialMessages).toEqual({});
		});
	});

	describe('function properties', () => {
		test('should allow setting triggerFallback function', () => {
			const mockTriggerFallback = vi.fn();
			service.triggerFallback = mockTriggerFallback;

			service.triggerFallback('https://example.com');

			expect(mockTriggerFallback).toHaveBeenCalledWith('https://example.com');
		});

		test('should allow setting submitForm function', async () => {
			const mockSubmitForm = vi.fn().mockResolvedValue(undefined);
			service.submitForm = mockSubmitForm;

			await service.submitForm('testForm');

			expect(mockSubmitForm).toHaveBeenCalledWith('testForm');
		});
	});
});
