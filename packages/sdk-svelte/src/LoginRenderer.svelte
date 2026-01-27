<script lang="ts">
	/* eslint-disable @typescript-eslint/no-explicit-any */
	import type {
		NativeParams,
		PartialRecord,
		WidgetType,
		LayoutWidget,
		LoginFlowState,
		Widget,
		IdTokenClaims,
		LoginFlowMessage,
	} from '@strivacity/sdk-core';
	import type { NativeContext, NativeFlowContextValue } from './types';
	import type { Component } from 'svelte';
	import { setContext, onMount } from 'svelte';
	import { FallbackError } from '@strivacity/sdk-core';
	import { unflattenObject } from '@strivacity/sdk-core/utils/object';
	import { useStrivacity } from './composables';

	let {
		params,
		widgets,
		sessionId = null,
		onlogin,
		onfallback,
		onclose,
		onerror,
		onglobalmessage,
		onblockready,
	}: {
		params?: NativeParams;
		widgets?: PartialRecord<WidgetType, Component>;
		sessionId?: string | null;
		onlogin?: (claims?: IdTokenClaims | null) => void;
		onfallback?: (error: FallbackError) => void;
		onclose?: () => void;
		onerror?: (error: any) => void;
		onglobalmessage?: (message: string) => void;
		onblockready?: ({ previousState, state }: { previousState: LoginFlowState; state: LoginFlowState }) => void;
	} = $props();

	const { sdk } = useStrivacity<NativeContext>();
	// svelte-ignore state_referenced_locally
	const loginHandler = sdk.login(params);
	const context = $state<NativeFlowContextValue>({
		loading: false,
		forms: {},
		messages: {},
		state: {},
		submitForm: async () => {},
		triggerFallback: () => {},
		triggerClose: () => {},
		setFormValue: () => {},
		setMessage: () => {},
	});

	const triggerFallback = (hostedUrl?: string, message?: string) => {
		const url = hostedUrl || context.state.hostedUrl;

		sdk.logging?.warn(message ? `Triggering fallback due to: ${message}` : 'Triggering fallback');

		if (!url) {
			const error = new Error('No hosted URL provided');
			sdk.logging?.error('Fallback error', error);
			throw error;
		}

		onfallback?.(new FallbackError(new URL(url)));
	};

	const triggerClose = () => {
		onclose?.();
	};

	const renderWidgets = (items: LayoutWidget['items']): Array<any> => {
		return items.map((item, idx) => {
			if (item.type === 'widget') {
				const form = context.state.forms?.find((f: any) => f.id === item.formId);
				const widget = form?.widgets.find((w: any) => w.id === item.widgetId);

				if (!form || !widget) {
					triggerFallback(undefined, `Unable to find form or widget for item: formId=${item.formId}, widgetId=${item.widgetId}`);
					return null;
				}

				const WidgetComponent = widgets?.[widget.type as keyof typeof widgets];

				if (!WidgetComponent) {
					triggerFallback(undefined, `No component found for widget type ${widget.type}`);
					return null;
				}

				return {
					component: WidgetComponent,
					props: { formId: form.id, config: widget },
					key: `${form.id}.${widget.id}`,
				};
			} else if (item.type === 'vertical' || item.type === 'horizontal') {
				const LayoutComponent = widgets?.layout;

				if (!LayoutComponent) {
					triggerFallback(undefined, 'No layout component provided');
					return null;
				}

				return {
					component: LayoutComponent,
					props: { formId: (item.items[0] as Widget).formId, type: item.type, tag: 'div' },
					children: renderWidgets(item.items),
					key: `layout-${idx}`,
				};
			} else {
				triggerFallback(undefined, 'Unknown item type in layout');
				return null;
			}
		});
	};

	const setFormValue = (formId: string, widgetId: string, value: unknown) => {
		if (value === '') {
			value = null;
		}

		context.forms = {
			...context.forms,
			[formId]: { ...(context.forms[formId] || {}), [widgetId]: value === '' ? null : value },
		};
	};

	const setMessage = (formId: string, widgetId: string, value: LoginFlowMessage) => {
		context.messages = {
			...context.messages,
			[formId]: { ...(context.messages[formId] || {}), [widgetId]: value },
		};
	};

	const submitForm = async (formId: string) => {
		try {
			context.loading = true;

			const data = await loginHandler?.submitForm(formId, unflattenObject(context.forms[formId]));
			await handleResponse(data);

			context.loading = false;
		} catch (error) {
			if (error instanceof FallbackError) {
				onfallback?.(error);
			} else {
				onerror?.(error);
			}
		}
	};

	const handleResponse = async (data?: LoginFlowState) => {
		if (await sdk.isAuthenticated) {
			onlogin?.(sdk.idTokenClaims);
		} else {
			const previousState = JSON.parse(JSON.stringify(context.state));
			const newState: LoginFlowState = {
				hostedUrl: data?.hostedUrl ?? context.state.hostedUrl,
				finalizeUrl: data?.finalizeUrl ?? context.state.finalizeUrl,
				screen: data?.screen ?? context.state.screen,
				forms: data?.forms ?? context.state.forms,
				layout: data?.layout ?? context.state.layout,
				messages: data?.messages ?? {},
				branding: data?.branding ?? context.state.branding,
			};

			if (newState.screen !== context.state.screen) {
				context.forms = {};
				context.messages = {};

				for (const form of newState.forms ?? []) {
					context.forms[form.id] = {};
					context.messages[form.id] = {};
				}
			} else {
				sdk.logging?.info(`Updating screen: ${newState.screen}`);
			}

			Object.keys(newState.messages ?? {}).forEach((formId) => {
				if (formId === 'global') {
					onglobalmessage?.(newState.messages?.global?.text ?? '');
				} else {
					context.messages[formId] = newState.messages![formId];
				}
			});

			context.state = newState;

			setTimeout(() => {
				onblockready?.({ previousState, state: JSON.parse(JSON.stringify(newState)) });
			}, 1);
		}
	};

	context.submitForm = submitForm;
	context.triggerFallback = triggerFallback;
	context.triggerClose = triggerClose;
	context.setFormValue = setFormValue;
	context.setMessage = setMessage;

	setContext('nativeFlowContext', context);

	onMount(async () => {
		try {
			const data = await loginHandler?.startSession(sessionId);

			if (data) {
				await handleResponse(data);
			}
		} catch (error) {
			if (error instanceof FallbackError) {
				onfallback?.(error);
			} else {
				onerror?.(error);
			}
		}
	});

	let renderedWidgets = $derived(context.state.screen && widgets?.layout ? renderWidgets(context.state.layout?.items ?? []) : []);
</script>

{#snippet renderItems(items: any[])}
	{#each items as item (item?.key)}
		{#if item}
			{@const Component = item.component}
			{#if item.children}
				<Component {...item.props}>
					{@render renderItems(item.children)}
				</Component>
			{:else}
				<Component {...item.props} />
			{/if}
		{/if}
	{/each}
{/snippet}

<div class="login-renderer">
	{#if context.state.screen && widgets?.layout}
		{@const LayoutComponent = widgets?.layout}
		<LayoutComponent formId={(context.state.layout?.items[0] as Widget).formId} type={context.state.layout?.type} tag="form">
			{@render renderItems(renderedWidgets)}
		</LayoutComponent>
	{:else if widgets?.loading}
		{@const LoadingComponent = widgets?.loading}
		<LoadingComponent />
	{/if}
</div>
