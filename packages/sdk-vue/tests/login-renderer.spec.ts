/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable vue/require-default-prop */
/* eslint-disable vue/one-component-per-file */
import { describe, test, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import type { Component } from 'vue';
import type { LoginFlowState, PartialRecord, WidgetType } from '@strivacity/sdk-core';
import { DefaultLogging } from '@strivacity/sdk-core/utils/Logging';
import LoginRenderer from '../src/login-renderer.vue';

const CheckboxWidget = defineComponent({
	props: {
		formId: String,
		config: Object,
	},
	setup: () => () => h('input', { type: 'checkbox', 'data-testid': 'checkbox-widget' }),
});

const DateWidget = defineComponent({
	props: { formId: String, config: Object },
	setup: () => () => h('input', { type: 'date', 'data-testid': 'date-widget' }),
});

const InputWidget = defineComponent({
	props: {
		formId: String,
		config: Object,
	},
	setup: () => () => h('input', { type: 'text', 'data-testid': 'input-widget' }),
});

const LayoutComponent = defineComponent({
	props: {
		type: String,
		formId: String,
		tag: String,
	},
	setup: (props, { slots }) => {
		return () => h(props.tag || 'div', { 'data-testid': `layout-${props.type}` }, slots.default?.());
	},
});

const LoadingComponent = defineComponent({
	setup: () => () => h('div', { 'data-testid': 'loading' }, 'Loading...'),
});

const MultiSelectWidget = defineComponent({
	props: {
		formId: String,
		config: Object,
	},
	setup: () => () =>
		h('select', { 'data-testid': 'multi-select-widget' }, [h('option', { value: 'option1' }, 'Option 1'), h('option', { value: 'option2' }, 'Option 2')]),
});

const PasscodeWidget = defineComponent({
	props: {
		formId: String,
		config: Object,
	},
	setup: () => () => h('input', { type: 'text', 'data-testid': 'passcode-widget' }),
});

const PasswordWidget = defineComponent({
	props: {
		formId: String,
		config: Object,
	},
	setup: () => () => h('input', { type: 'password', 'data-testid': 'password-widget' }),
});

const PhoneWidget = defineComponent({
	props: {
		formId: String,
		config: Object,
	},
	setup: () => () => h('input', { type: 'tel', 'data-testid': 'phone-widget' }),
});

const SelectWidget = defineComponent({
	props: {
		formId: String,
		config: Object,
	},
	setup: () => () =>
		h('select', { 'data-testid': 'select-widget' }, [h('option', { value: 'option1' }, 'Option 1'), h('option', { value: 'option2' }, 'Option 2')]),
});

const StaticWidget = defineComponent({
	props: {
		formId: String,
		config: Object,
	},
	setup: () => (props: any) => h('div', { 'data-testid': 'static-widget' }, props.config.value),
});

const SubmitWidget = defineComponent({
	props: {
		formId: String,
		config: Object,
	},
	setup: () => () => h('button', { 'data-testid': 'button-widget' }, 'Submit'),
});

const mockWidgets: PartialRecord<WidgetType, Component> = {
	checkbox: CheckboxWidget,
	date: DateWidget,
	input: InputWidget,
	layout: LayoutComponent,
	loading: LoadingComponent,
	multiSelect: MultiSelectWidget,
	passcode: PasscodeWidget,
	password: PasswordWidget,
	phone: PhoneWidget,
	select: SelectWidget,
	static: StaticWidget,
	submit: SubmitWidget,
};

const mockLoginHandler = {
	startSession: vi.fn(),
	submitForm: vi.fn(),
};

const mockSdk: any = {
	login: vi.fn(() => mockLoginHandler),
	get isAuthenticated(): Promise<boolean> {
		return Promise.resolve(this._isAuthenticated);
	},
	set isAuthenticated(val: boolean) {
		this._isAuthenticated = val;
	},
	_isAuthenticated: false,
	idTokenClaims: null,
	logging: new DefaultLogging(),
};

vi.mock('../src/composables', () => ({
	useStrivacity: vi.fn(() => ({
		sdk: mockSdk,
	})),
}));

const mockInitialState: LoginFlowState = {
	screen: 'identification',
	hostedUrl: 'https://brandtegrity.io/hostedUrl',
	forms: [
		{
			type: 'form',
			id: 'identifier',
			widgets: [
				{
					type: 'static',
					id: 'section-title',
					value: 'Sign in',
					render: {
						type: 'text',
					},
				},
				{
					type: 'input',
					id: 'identifier',
					label: 'Email address',
					readonly: false,
					autocomplete: 'username',
					inputmode: 'email',
				},
				{
					type: 'submit',
					id: 'submit',
					label: 'Continue',
					render: {
						type: 'button',
						hint: {
							variant: 'primary',
						},
					},
				},
			],
		},
		{
			type: 'form',
			id: 'additionalActions/registration',
			widgets: [
				{
					type: 'static',
					id: 'dont-have-an-account',
					value: "Don't have an account?",
					render: {
						type: 'text',
					},
				},
				{
					type: 'submit',
					id: 'submit',
					label: 'Sign up',
					render: {
						type: 'link',
						hint: {
							variant: 'primary',
						},
					},
				},
			],
		},
	],
	layout: {
		type: 'vertical',
		items: [
			{
				type: 'widget',
				formId: 'identifier',
				widgetId: 'section-title',
			},
			{
				type: 'widget',
				formId: 'identifier',
				widgetId: 'identifier',
			},
			{
				type: 'widget',
				formId: 'identifier',
				widgetId: 'submit',
			},
			{
				type: 'horizontal',
				items: [
					{
						type: 'widget',
						formId: 'additionalActions/registration',
						widgetId: 'dont-have-an-account',
					},
					{
						type: 'widget',
						formId: 'additionalActions/registration',
						widgetId: 'submit',
					},
				],
			},
		],
	},
};

const componentFactory = async (props = {}) => {
	const wrapper = mount(LoginRenderer, {
		props: {
			widgets: mockWidgets,
			...props,
		},
		global: {
			stubs: {
				teleport: true,
			},
		},
	});

	await nextTick();

	return wrapper;
};

describe('StyLoginRenderer', () => {
	let component: VueWrapper<InstanceType<typeof LoginRenderer>>;
	let loggingSpy: Record<string, MockInstance>;

	beforeEach(() => {
		mockSdk._isAuthenticated = false;
		mockLoginHandler.startSession.mockResolvedValue(mockInitialState);
		mockLoginHandler.submitForm.mockResolvedValue({});
		loggingSpy = {
			warn: vi.spyOn(mockSdk.logging, 'warn'),
			error: vi.spyOn(mockSdk.logging, 'error'),
			info: vi.spyOn(mockSdk.logging, 'info'),
		};
	});

	afterEach(() => {
		component?.unmount();
	});

	test('shows loading component initially', () => {
		component = mount(LoginRenderer, { props: { widgets: mockWidgets } });

		expect(component.find('[data-testid="loading"]').exists()).toBe(true);
	});

	test('emits blockReady after rendering a state', async () => {
		vi.useFakeTimers();

		component = await componentFactory();
		await nextTick();

		vi.runAllTimers();

		await vi.waitFor(() => expect(component.emitted('blockReady')).toHaveLength(1));
		await vi.waitFor(() =>
			expect(component.emitted('blockReady')![0][0]).toEqual({
				previousState: {},
				state: mockInitialState,
			}),
		);

		vi.useRealTimers();
	});

	describe('onMounted', () => {
		test('initializes SDK w/o parameters', async () => {
			component = await componentFactory();
			expect(mockSdk.login).toHaveBeenCalledWith({});
		});

		test('initializes SDK w/ parameters', async () => {
			const params = { clientId: 'test-client' };
			component = await componentFactory({ params });
			expect(mockSdk.login).toHaveBeenCalledWith(params);
		});

		test('calls startSession on mount w/ sessionId', async () => {
			const sessionId = 'test-session-123';
			component = await componentFactory({ sessionId });

			expect(mockLoginHandler.startSession).toHaveBeenCalledWith(sessionId);
		});

		test('calls startSession w/ null when no sessionId provided', async () => {
			component = await componentFactory();

			expect(mockLoginHandler.startSession).toHaveBeenCalledWith(null);
		});

		test('emits fallback correctly', async () => {
			const { FallbackError } = await import('@strivacity/sdk-core');
			const fallbackError = new FallbackError(new URL('http://fallback.url'));
			mockLoginHandler.startSession.mockRejectedValue(fallbackError);

			component = await componentFactory();

			expect(component.emitted('fallback')).toHaveLength(1);
			expect(component.emitted('fallback')![0][0]).toBe(fallbackError);
		});

		test('emits error correctly', async () => {
			const error = new Error('Network error');
			mockLoginHandler.startSession.mockRejectedValue(error);

			component = await componentFactory();

			expect(component.emitted('error')).toHaveLength(1);
			expect(component.emitted('error')![0][0]).toBe(error);
		});

		test('emits globalMessage when global message is present', async () => {
			mockLoginHandler.startSession.mockResolvedValue({ messages: { global: { type: 'error', text: 'Error message' } } });
			component = await componentFactory();

			expect(component.emitted('globalMessage')).toHaveLength(1);
			expect(component.emitted('globalMessage')![0][0]).toBe('Error message');
		});

		test('emits login if already authenticated after startSession', async () => {
			mockSdk._isAuthenticated = true;
			mockSdk.idTokenClaims = { sub: 'user-123', email: 'test@example.com' };
			component = await componentFactory();

			expect(component.emitted('login')).toHaveLength(1);
			expect(component.emitted('login')![0][0]).toEqual(mockSdk.idTokenClaims);
		});
	});

	describe('rendering', () => {
		test('should render initial state after startSession', async () => {
			component = await componentFactory();
			await nextTick();

			expect(component.find('[data-testid="loading"]').exists()).toBe(false);
			expect(component.find('[data-testid="layout-vertical"]').exists()).toBe(true);
		});

		describe('triggerFallback', () => {
			test('triggers fallback w/ hosted URL from state', async () => {
				component = await componentFactory();

				component.vm.triggerFallback();

				expect(loggingSpy.warn).toHaveBeenCalledWith('Triggering fallback');
				expect(component.emitted('fallback')).toHaveLength(1);
				const fallbackError = component.emitted('fallback')![0][0] as any;
				expect(fallbackError.url.href).toBe('https://brandtegrity.io/hostedUrl');
			});

			test('triggers fallback w/ provided URL', async () => {
				component = await componentFactory();

				component.vm.triggerFallback('http://custom.fallback.url');

				expect(loggingSpy.warn).toHaveBeenCalledWith('Triggering fallback');
				expect(component.emitted('fallback')).toHaveLength(1);
				const fallbackError = component.emitted('fallback')![0][0] as any;
				expect(fallbackError.url.href).toBe('http://custom.fallback.url/');
			});

			test('throws error when no hosted URL is available', () => {
				component.vm.state = {};

				expect(() => component.vm.triggerFallback()).toThrow('No hosted URL provided');
				expect(loggingSpy.error).toHaveBeenCalledWith('Fallback error', expect.any(Error));
			});

			test('triggers fallback when widget component is missing', async () => {
				mockLoginHandler.startSession.mockResolvedValue({
					...mockInitialState,
					layout: {
						type: 'vertical',
						items: [{ type: 'widget', formId: 'identifier', widgetId: 'nonexistent-widget' }],
					},
				});

				component = await componentFactory();
				await nextTick();

				expect(loggingSpy.warn).toHaveBeenCalledWith(
					'Triggering fallback due to: Unable to find form or widget for item: formId=identifier, widgetId=nonexistent-widget',
				);
				expect(component.emitted('fallback')).toHaveLength(1);
			});

			test('triggers fallback when form is missing', async () => {
				mockLoginHandler.startSession.mockResolvedValue({
					...mockInitialState,
					layout: {
						type: 'vertical',
						items: [{ type: 'widget', formId: 'nonexistent-form', widgetId: 'identifier' }],
					},
				});

				component = await componentFactory();
				await nextTick();

				expect(loggingSpy.warn).toHaveBeenCalledWith(
					'Triggering fallback due to: Unable to find form or widget for item: formId=nonexistent-form, widgetId=identifier',
				);
				expect(component.emitted('fallback')).toHaveLength(1);
			});

			test('triggers fallback when widget type component is not provided', async () => {
				const widgetsWithoutInput = { ...mockWidgets };
				delete widgetsWithoutInput.input;

				mockLoginHandler.startSession.mockResolvedValue(mockInitialState);

				component = await componentFactory({ widgets: widgetsWithoutInput });
				await nextTick();

				expect(loggingSpy.warn).toHaveBeenCalledWith('Triggering fallback due to: No component found for widget type input');
				expect(component.emitted('fallback')).toHaveLength(1);
			});

			test('triggers fallback for unknown item type', async () => {
				const stateWithUnknownType = {
					...mockInitialState,
					layout: {
						type: 'vertical',
						items: [{ type: 'unknown-type', formId: 'identifier', widgetId: 'identifier' } as any],
					},
				};

				mockLoginHandler.startSession.mockResolvedValue(stateWithUnknownType);
				component = await componentFactory();
				await nextTick();

				expect(loggingSpy.warn).toHaveBeenCalledWith('Triggering fallback due to: Unknown item type in layout');
				expect(component.emitted('fallback')).toHaveLength(1);
			});
		});
	});

	describe('Form management', () => {
		test('converts empty string to null', () => {
			component.vm.setFormValue('password', 'w1', '');
			expect(component.vm.forms['password']['w1']).toBe(null);
		});

		test('sets messages correctly', () => {
			const message = { text: 'Error message', type: 'error' };
			component.vm.setMessage('password', 'w1', message);
			expect(component.vm.messages['password']['w1']).toEqual(message);
		});

		test('submits form correctly', async () => {
			const nextState: LoginFlowState = {
				screen: 'password',
				hostedUrl: 'https://brandtegrity.io/hostedUrl',
				forms: [
					{
						type: 'form',
						id: 'password',
						widgets: [
							{ type: 'static', id: 'section-title', value: 'Enter password', render: { type: 'text' } },
							{ type: 'password', id: 'password', label: 'Enter your password', qualityIndicator: false },
							{
								type: 'checkbox',
								id: 'keepMeLoggedIn',
								label: 'Keep me logged in',
								readonly: false,
								value: false,
								render: { type: 'checkboxShown', labelType: 'text' },
							},
							{ type: 'submit', id: 'submit', label: 'Continue', render: { type: 'button', hint: { variant: 'primary' } } },
						],
					},
				],
				layout: {
					type: 'vertical',
					items: [
						{ type: 'widget', formId: 'password', widgetId: 'section-title' },
						{ type: 'widget', formId: 'password', widgetId: 'password' },
						{ type: 'widget', formId: 'password', widgetId: 'keepMeLoggedIn' },
						{ type: 'widget', formId: 'password', widgetId: 'submit' },
					],
				},
			};
			mockLoginHandler.submitForm.mockResolvedValue(nextState);

			component.vm.setFormValue('identifier', 'identifier', 'test');
			await component.vm.submitForm('identifier');

			expect(mockLoginHandler.submitForm).toHaveBeenCalledWith('identifier', { identifier: 'test' });
		});

		test('emits fallback correctly', async () => {
			const { FallbackError } = await import('@strivacity/sdk-core');
			const fallbackError = new FallbackError(new URL('http://fallback.url'));
			mockLoginHandler.startSession.mockResolvedValue(mockInitialState);
			mockLoginHandler.submitForm.mockRejectedValue(fallbackError);

			component = await componentFactory();
			await component.vm.submitForm('identifier');

			expect(component.emitted('fallback')).toHaveLength(1);
			expect(component.emitted('fallback')![0][0]).toBe(fallbackError);
		});

		test('emits error correctly', async () => {
			const error = new Error('Network error');
			mockLoginHandler.startSession.mockResolvedValue(mockInitialState);
			mockLoginHandler.submitForm.mockRejectedValue(error);

			component = await componentFactory();
			await component.vm.submitForm('identifier');

			expect(component.emitted('error')).toHaveLength(1);
			expect(component.emitted('error')![0][0]).toBe(error);
		});

		test('emits login if already authenticated after startSession', async () => {
			mockSdk._isAuthenticated = true;
			mockSdk.idTokenClaims = { sub: 'user-123', email: 'test@example.com' };
			component = await componentFactory();

			expect(component.emitted('login')).toHaveLength(1);
			expect(component.emitted('login')![0][0]).toEqual(mockSdk.idTokenClaims);
		});
	});

	describe('Screen transitions', () => {
		test('resets forms and messages when screen changes', async () => {
			component.vm.setFormValue('password', 'w1', 'testvalue');
			component.vm.setMessage('password', 'w1', { text: 'test message' });

			await component.vm.handleResponse({ screen: 'mfa', forms: [{ id: 'mfa', widgets: [] }] });
			await nextTick();

			expect(component.vm.forms).toEqual({ mfa: {} });
			expect(component.vm.messages).toEqual({ mfa: {} });
		});

		test('preserves forms and messages when screen stays the same', async () => {
			component = await componentFactory();
			component.vm.setFormValue('identifier', 'w1', 'testvalue');
			component.vm.setMessage('identifier', 'w1', { text: 'test message' });

			await component.vm.handleResponse({ screen: 'identification', forms: mockInitialState.forms });
			await nextTick();

			expect(loggingSpy.info).toHaveBeenCalledWith('Updating screen: identification');
			expect(component.vm.forms['identifier']['w1']).toBe('testvalue');
			expect(component.vm.messages['identifier']['w1']).toEqual({ text: 'test message' });
		});

		test('should update messages when screen changes', async () => {
			const newState: LoginFlowState = {
				...mockInitialState,
				messages: {
					identifier: { type: 'error', text: 'Invalid identifier' },
				},
			};

			mockLoginHandler.startSession.mockResolvedValue(newState);
			component = await componentFactory();
			await nextTick();

			expect(component.vm.messages.identifier).toEqual({ type: 'error', text: 'Invalid identifier' });
		});
	});
});
