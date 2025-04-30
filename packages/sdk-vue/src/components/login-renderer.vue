<!-- eslint-disable no-console -->
<script setup lang="ts">
import type { VNode, Component, PropType } from 'vue';
import type { PartialRecord, NativeParams, WidgetType, LayoutWidget, LoginFlowState, Widget } from '@strivacity/sdk-core';
import type { NativeContext, LoginContext } from '../';
import { defineComponent, provide, ref, h, onMounted } from 'vue';
import { FallbackError } from '@strivacity/sdk-core';
import { useStrivacity } from '../';

const emit = defineEmits(['login', 'fallback', 'error', 'globalMessage']);
const props = withDefaults(
	defineProps<{
		options: NativeParams;
		widgets: PartialRecord<WidgetType, Component>;
		sessionId?: string | null;
	}>(),
	{
		options: () => ({}),
		widgets: () => ({}),
		sessionId: null,
	},
);

const { sdk } = useStrivacity<NativeContext>();
const loginHandler = sdk.login(props.options);
const initialized = ref<boolean>(false);
const loading = ref<boolean>(false);
const formContexts = ref<Record<string, Record<string, unknown>>>({});
const messageContexts = ref<Record<string, unknown>>({});
const state = ref<LoginFlowState>({});

provide<LoginContext>('loginContext', {
	loading,
	formContexts,
	messageContexts,
	state,
	submitForm,
	triggerFallback,
	setFormState: (formId: string, widgetId: string, value: unknown): void => {
		if (value === '') {
			value = null;
		}

		formContexts.value[formId][widgetId] = value;
	},
	setMessage: (formId: string, widgetId: string, value: string | null): void => {
		(messageContexts.value[formId] as Record<string, string | null>)[widgetId] = value;
	},
});

const WidgetRenderer = defineComponent({
	props: {
		items: {
			type: Array as PropType<LayoutWidget['items']>,
			default: () => [],
		},
		widgets: {
			type: Object,
			default: () => ({}),
		},
	},
	setup: (props) => () =>
		props.items.map((item): VNode | null => {
			if (item.type === 'widget') {
				const form = state.value?.forms?.find((form) => form.id === item.formId);
				const widget = form?.widgets.find((widget) => widget.id === item.widgetId);

				if (!form || !widget || !props.widgets[widget.type]) {
					triggerFallback();
					return null;
				}

				return h(props.widgets[widget.type], {
					key: `${form.id}.${widget.id}`,
					formId: form.id,
					config: widget,
					'data-form-id': form.id,
					'data-widget': widget.type,
					'data-widget-id': widget.id,
				});
			} else if (item.type === 'vertical' || item.type === 'horizontal') {
				if (!props.widgets.layout) {
					triggerFallback();
					return null;
				}

				return h(props.widgets.layout, { formId: (item.items[0] as Widget).formId, type: item.type, 'data-widget': 'layout', 'data-type': item.type }, () =>
					h(WidgetRenderer, { items: item.items, widgets: props.widgets }),
				);
			} else {
				triggerFallback();
				return null;
			}
		}),
});

onMounted(async () => {
	try {
		const data = await loginHandler.startSession(props.sessionId);
		const newState: LoginFlowState = {
			hostedUrl: data.hostedUrl ?? state.value.hostedUrl,
			finalizeUrl: data.finalizeUrl ?? state.value.finalizeUrl,
			screen: data.screen ?? state.value.screen,
			forms: data.forms ?? state.value.forms,
			layout: data.layout ?? state.value.layout,
			messages: data.messages ?? state.value.messages,
			branding: data.branding ?? state.value.branding,
		};

		if (await sdk.isAuthenticated) {
			emit('login', sdk.idTokenClaims);
		} else {
			if (newState.screen != state.value.screen) {
				formContexts.value = {};
				messageContexts.value = {};

				for (const form of newState.forms ?? []) {
					formContexts.value[form.id] = {};
					messageContexts.value[form.id] = {};
				}
			}

			Object.keys(newState.messages ?? {}).forEach((formId) => {
				if (formId === 'global') {
					emit('globalMessage', newState.messages?.global?.text ?? '');
				} else {
					messageContexts.value[formId] = newState.messages![formId];
				}
			});

			state.value = newState;
			initialized.value = true;
		}
	} catch (error) {
		if (error instanceof FallbackError) {
			emit('fallback', error);
		} else {
			emit('error', error);
		}
	}
});

async function submitForm(formId: string): Promise<void> {
	try {
		loading.value = true;

		const data = await loginHandler.submitForm(formId, convertFormContext(formContexts.value[formId]));

		if (await sdk.isAuthenticated) {
			emit('login', sdk.idTokenClaims);
		} else {
			const newState: LoginFlowState = {
				hostedUrl: data.hostedUrl ?? state.value.hostedUrl,
				finalizeUrl: data.finalizeUrl ?? state.value.finalizeUrl,
				screen: data.screen ?? state.value.screen,
				forms: data.forms ?? state.value.forms,
				layout: data.layout ?? state.value.layout,
				messages: data.messages ?? state.value.messages,
				branding: data.branding ?? state.value.branding,
			};

			if (newState.screen !== state.value.screen) {
				formContexts.value = {};
				messageContexts.value = {};

				for (const form of newState.forms ?? []) {
					formContexts.value[form.id] = {};
					messageContexts.value[form.id] = {};
				}
			}

			Object.keys(newState.messages ?? {}).forEach((formId) => {
				if (formId === 'global') {
					emit('globalMessage', newState.messages?.global?.text ?? '');
				} else {
					messageContexts.value[formId] = newState.messages![formId];
				}
			});

			state.value = newState;
			loading.value = false;
		}
	} catch (error) {
		if (error instanceof FallbackError) {
			emit('fallback', error);
		} else {
			emit('error', error);
		}
	}
}

function triggerFallback(hostedUrl?: string): void {
	if (!hostedUrl) {
		hostedUrl = state.value.hostedUrl;
	}
	if (!hostedUrl) {
		throw new Error('No hosted URL provided');
	}

	emit('fallback', hostedUrl);
}

function convertFormContext(flatObject: Record<string, unknown>): Record<string, unknown> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const nestedObject: Record<string, any> = {};

	for (const key in flatObject) {
		const keys = key.split('.');

		keys.reduce((acc, part, index) => {
			if (index === keys.length - 1) {
				acc[part] = flatObject[key];
			} else {
				acc[part] = acc[part] || {};
			}

			return acc[part];
		}, nestedObject);
	}

	return nestedObject;
}
</script>

<template>
	<div class="login-renderer">
		<component :is="widgets.layout" v-if="state.screen" :formId="(state.layout?.items[0] as Widget).formId" :type="state.layout?.type" data-widget="layout">
			<WidgetRenderer :items="state.layout?.items" :widgets="widgets" />
		</component>
		<component :is="widgets.loading" v-else />
	</div>
</template>
