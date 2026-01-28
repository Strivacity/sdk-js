/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NativeParams, PartialRecord, WidgetType, LayoutWidget, LoginFlowState, Widget, IdTokenClaims, LoginFlowMessage } from '@strivacity/sdk-core';
import type { NativeContext, NativeFlowContextValue } from './types';
import React, { useRef, useState, useEffect, createContext, useCallback } from 'react';
import { FallbackError } from '@strivacity/sdk-core';
import { unflattenObject } from '@strivacity/sdk-core/utils/object';
import { useStrivacity } from './composables';

export const NativeFlowContext = createContext<NativeFlowContextValue | null>(null);
const formData: Record<string, Record<string, unknown>> = {};

const StyWidgetRenderer: React.FC<{
	items: LayoutWidget['items'];
	widgets: PartialRecord<WidgetType, React.ComponentType<any>>;
	state: LoginFlowState;
	triggerFallback: (hostedUrl?: string, message?: string) => void;
}> = ({ items, widgets, state, triggerFallback }) => {
	return (
		<>
			{items.map((item, idx) => {
				if (item.type === 'widget') {
					const form = state.forms?.find((f) => f.id === item.formId);
					const widget = form?.widgets.find((w) => w.id === item.widgetId);

					if (!form || !widget) {
						triggerFallback(undefined, `Unable to find form or widget for item: formId=${item.formId}, widgetId=${item.widgetId}`);
						return null;
					}

					const WidgetComponent = widgets[widget.type];

					if (!WidgetComponent) {
						triggerFallback(undefined, `No component found for widget type ${widget.type}`);
						return null;
					}

					return <WidgetComponent key={`${form.id}.${widget.id}`} formId={form.id} config={widget} />;
				} else if (item.type === 'vertical' || item.type === 'horizontal') {
					const LayoutComponent = widgets.layout;

					if (!LayoutComponent) {
						triggerFallback(undefined, 'No layout component provided');
						return null;
					}

					return (
						<LayoutComponent key={idx} formId={(item.items[0] as Widget).formId} type={item.type}>
							<StyWidgetRenderer items={item.items} widgets={widgets} state={state} triggerFallback={triggerFallback} />
						</LayoutComponent>
					);
				} else {
					triggerFallback(undefined, 'Unknown item type in layout');
					return null;
				}
			})}
		</>
	);
};

export const StyLoginRenderer: React.FC<{
	params?: NativeParams;
	widgets?: PartialRecord<WidgetType, React.ComponentType<any>>;
	sessionId?: string | null;
	onLogin?: (claims?: IdTokenClaims | null) => void;
	onFallback?: (error: FallbackError) => void;
	onClose?: () => void;
	onError?: (error: any) => void;
	onGlobalMessage?: (message: string) => void;
	onBlockReady?: ({ previousState, state }: { previousState: LoginFlowState; state: LoginFlowState }) => void;
}> = (props) => {
	const { params, widgets, sessionId, onLogin, onFallback, onClose, onError, onGlobalMessage, onBlockReady } = {
		params: {},
		widgets: {},
		sessionId: null,
		...props,
	};
	const { sdk } = useStrivacity<NativeContext>();
	const loginHandlerRef = useRef<ReturnType<(typeof sdk)['login']> | null>(null);

	const [loading, setLoading] = useState(false);
	const [forms, setForms] = useState<Record<string, Record<string, unknown>>>({});
	const [messages, setMessages] = useState<Record<string, Record<string, LoginFlowMessage>>>({});
	const [state, setState] = useState<LoginFlowState>({});

	const triggerFallback = useCallback(
		(hostedUrl?: string, message?: string) => {
			const url = hostedUrl || state.hostedUrl;

			sdk.logging?.warn(message ? `Triggering fallback due to: ${message}` : 'Triggering fallback');

			if (!url) {
				const error = new Error('No hosted URL provided');
				sdk.logging?.error('Fallback error', error);
				throw error;
			}

			onFallback?.(new FallbackError(new URL(url)));
		},
		[state, onFallback],
	);

	const triggerClose = useCallback(() => {
		onClose?.();
	}, [onClose]);

	const setFormValue = useCallback((formId: string, widgetId: string, value: unknown) => {
		formData[formId] = {
			...formData[formId],
			[widgetId]: value === '' ? null : value,
		};

		setForms((prev) => ({
			...prev,
			[formId]: { ...(prev[formId] || {}), [widgetId]: value === '' ? null : value },
		}));
	}, []);

	const setMessage = useCallback((formId: string, widgetId: string, value: LoginFlowMessage) => {
		setMessages((prev) => ({
			...prev,
			[formId]: { ...(prev[formId] || {}), [widgetId]: value },
		}));
	}, []);

	const submitForm = useCallback(
		async (formId: string) => {
			try {
				setLoading(true);

				const data = await loginHandlerRef.current?.submitForm(formId, unflattenObject(formData[formId]));

				if (await sdk.isAuthenticated) {
					onLogin?.(sdk.idTokenClaims);
				} else {
					const previousState = structuredClone(state);
					const newState: LoginFlowState = {
						hostedUrl: data?.hostedUrl ?? state.hostedUrl,
						finalizeUrl: data?.finalizeUrl ?? state.finalizeUrl,
						screen: data?.screen ?? state.screen,
						forms: data?.forms ?? state.forms,
						layout: data?.layout ?? state.layout,
						messages: data?.messages ?? {},
						branding: data?.branding ?? state.branding,
					};

					if (newState.screen !== state.screen) {
						const newForms: typeof forms = {};
						const newMessages: typeof messages = {};

						for (const form of newState.forms ?? []) {
							newForms[form.id] = {};
							newMessages[form.id] = {};
						}

						setForms(newForms);
						setMessages(newMessages);
					}

					Object.keys(newState.messages ?? {}).forEach((formId) => {
						if (formId === 'global') {
							onGlobalMessage?.(newState.messages?.global?.text ?? '');
						} else {
							setMessages((prev) => ({
								...prev,
								[formId]: newState.messages![formId],
							}));
						}
					});

					setState(newState);
					setLoading(false);

					setTimeout(() => {
						onBlockReady?.({ previousState, state: structuredClone(newState) });
					}, 1);
				}
			} catch (error) {
				if (error instanceof FallbackError) {
					onFallback?.(error);
				} else {
					onError?.(error);
				}
			}
		},
		[sdk, params, forms, state, onLogin, onFallback, onClose, onError, onGlobalMessage, onBlockReady],
	);

	const contextValue: NativeFlowContextValue = {
		loading,
		forms,
		messages,
		state,
		submitForm,
		triggerFallback,
		triggerClose,
		setFormValue,
		setMessage,
	};

	useEffect(() => {
		loginHandlerRef.current = sdk.login(params);

		void (async () => {
			try {
				const data = await loginHandlerRef.current?.startSession(sessionId);
				const previousState = structuredClone(state);
				const newState: LoginFlowState = {
					hostedUrl: data?.hostedUrl ?? state.hostedUrl,
					finalizeUrl: data?.finalizeUrl ?? state.finalizeUrl,
					screen: data?.screen ?? state.screen,
					forms: data?.forms ?? state.forms,
					layout: data?.layout ?? state.layout,
					messages: data?.messages ?? {},
					branding: data?.branding ?? state.branding,
				};

				if (await sdk.isAuthenticated) {
					onLogin?.(sdk.idTokenClaims);
				} else {
					if (newState.screen !== state.screen) {
						const newForms: typeof forms = {};
						const newMessages: typeof messages = {};

						for (const form of newState.forms ?? []) {
							newForms[form.id] = {};
							newMessages[form.id] = {};
						}

						setForms(newForms);
						setMessages(newMessages);
					} else {
						sdk.logging?.info(`Updating screen: ${newState.screen}`);
					}

					Object.keys(newState.messages ?? {}).forEach((formId) => {
						if (formId === 'global') {
							onGlobalMessage?.(newState.messages?.global?.text ?? '');
						} else {
							setMessages((prev) => ({
								...prev,
								[formId]: newState.messages![formId],
							}));
						}
					});

					setState(newState);

					setTimeout(() => {
						onBlockReady?.({ previousState, state: structuredClone(newState) });
					}, 1);
				}
			} catch (error) {
				if (error instanceof FallbackError) {
					onFallback?.(error);
				} else {
					onError?.(error);
				}
			}
		})();
	}, []);

	return (
		<NativeFlowContext.Provider value={contextValue}>
			<div className="login-renderer">
				{state.screen && widgets.layout
					? React.createElement(
							widgets.layout,
							{
								formId: (state.layout?.items?.[0] as Widget)?.formId,
								type: state.layout?.type,
								tag: 'form',
							},
							<StyWidgetRenderer items={state.layout?.items ?? []} widgets={widgets} state={state} triggerFallback={triggerFallback} />,
						)
					: widgets.loading
						? React.createElement(widgets.loading)
						: null}
			</div>
		</NativeFlowContext.Provider>
	);
};
