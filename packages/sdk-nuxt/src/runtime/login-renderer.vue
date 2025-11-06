<!-- eslint-disable no-console -->
<script lang="ts" setup>
import type { VNode, Component, PropType } from 'vue';
import type { PartialRecord, NativeParams, WidgetType, LayoutWidget, LoginFlowState, Widget, IdTokenClaims, LoginFlowMessage } from '@strivacity/sdk-core';
import type { NativeFlow } from '@strivacity/sdk-core/flows/NativeFlow';
import type { NativeFlowContextValue } from '../types';
import { defineComponent, provide, ref, h, onMounted } from 'vue';
import { FallbackError } from '@strivacity/sdk-core';
import { unflattenObject } from '@strivacity/sdk-core/utils/object';
import { useStrivacity } from './composables';

const { sdk } = useStrivacity();

const props = withDefaults(
	defineProps<{
		params?: NativeParams;
		widgets?: PartialRecord<WidgetType, Component>;
		sessionId?: string | null;
	}>(),
	{
		params: () => ({}),
		widgets: () => ({}),
		sessionId: null,
	},
);
const emit = defineEmits<{
	login: [IdTokenClaims | null | undefined];
	fallback: [FallbackError];
	close: [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	error: [any];
	globalMessage: [string];
	blockReady: [{ previousState: LoginFlowState; state: LoginFlowState }];
}>();

const WidgetRenderer = defineComponent({
	props: {
		items: {
			type: Array as PropType<LayoutWidget['items']>,
			default: () => [],
		},
		widgets: {
			type: Object as PropType<PartialRecord<WidgetType, Component>>,
			default: () => ({}),
		},
	},
	setup: (props) => () =>
		props.items.map((item): VNode | null => {
			if (item.type === 'widget') {
				const form = state.value?.forms?.find((form) => form.id === item.formId);
				const widget = form?.widgets.find((widget) => widget.id === item.widgetId);

				if (!form || !widget) {
					triggerFallback();
					return null;
				}

				const component = props.widgets[widget.type];

				if (!component) {
					triggerFallback();
					return null;
				}

				return h(component, { key: `${form.id}.${widget.id}`, formId: form.id, config: widget });
			} else if (item.type === 'vertical' || item.type === 'horizontal') {
				if (!props.widgets.layout) {
					triggerFallback();
					return null;
				}

				return h(props.widgets.layout, { formId: (item.items[0] as Widget).formId, type: item.type }, () =>
					h(WidgetRenderer, { items: item.items, widgets: props.widgets }),
				);
			} else {
				triggerFallback();
				return null;
			}
		}),
});

const loginHandler = (sdk as NativeFlow).login(props.params);
const loading = ref<boolean>(false);
const forms = ref<Record<string, Record<string, unknown>>>({});
const messages = ref<Record<string, Record<string, LoginFlowMessage>>>({});
const state = ref<LoginFlowState>({});

provide<NativeFlowContextValue>('nativeFlowContext', {
	loading,
	forms,
	messages,
	state,
	submitForm,
	triggerFallback,
	triggerClose,
	setFormValue,
	setMessage,
});

onMounted(async () => {
	try {
		const data = await loginHandler.startSession(props.sessionId);

		if (data) {
			await handleResponse(data);
		}
	} catch (error) {
		if (error instanceof FallbackError) {
			emit('fallback', error);
		} else {
			emit('error', error);
		}
	}
});

function triggerFallback(hostedUrl?: string): void {
	const url = hostedUrl || state.value.hostedUrl;

	if (!url) {
		throw new Error('No hosted URL provided');
	}

	emit('fallback', new FallbackError(new URL(url)));
}

function triggerClose(): void {
	emit('close');
}

function setFormValue(formId: string, widgetId: string, value: unknown) {
	if (value === '') {
		value = null;
	}

	if (forms.value[formId] === undefined) {
		forms.value[formId] = {};
	}

	forms.value[formId][widgetId] = value;
}

function setMessage(formId: string, widgetId: string, value: LoginFlowMessage) {
	if (messages.value[formId] === undefined) {
		messages.value[formId] = {};
	}

	messages.value[formId][widgetId] = value;
}

async function submitForm(formId: string): Promise<void> {
	try {
		loading.value = true;

		const data = await loginHandler.submitForm(formId, unflattenObject(forms.value[formId]));
		await handleResponse(data);

		loading.value = false;
	} catch (error) {
		if (error instanceof FallbackError) {
			emit('fallback', error);
		} else {
			emit('error', error);
		}
	}
}

async function handleResponse(data?: LoginFlowState) {
	if (await sdk.isAuthenticated) {
		emit('login', sdk.idTokenClaims);
	} else {
		const previousState = JSON.parse(JSON.stringify(state.value));
		const newState: LoginFlowState = {
			hostedUrl: data?.hostedUrl ?? state.value.hostedUrl,
			finalizeUrl: data?.finalizeUrl ?? state.value.finalizeUrl,
			screen: data?.screen ?? state.value.screen,
			forms: data?.forms ?? state.value.forms,
			layout: data?.layout ?? state.value.layout,
			messages: data?.messages ?? state.value.messages,
			branding: data?.branding ?? state.value.branding,
		};

		if (newState.screen != state.value.screen) {
			forms.value = {};
			messages.value = {};

			for (const form of newState.forms ?? []) {
				forms.value[form.id] = {};
				messages.value[form.id] = {};
			}
		}

		Object.keys(newState.messages ?? {}).forEach((formId) => {
			if (formId === 'global') {
				emit('globalMessage', newState.messages?.global?.text ?? '');
			} else {
				messages.value[formId] = newState.messages![formId];
			}
		});

		state.value = newState;

		setTimeout(() => {
			emit('blockReady', { previousState, state: JSON.parse(JSON.stringify(state.value)) });
		});
	}
}
</script>

<template>
	<div class="login-renderer">
		<component :is="widgets.layout" v-if="state.screen" :formId="(state.layout?.items[0] as Widget).formId" :type="state.layout?.type" tag="form">
			<WidgetRenderer :items="state.layout?.items" :widgets="widgets" />
		</component>
		<component :is="widgets.loading" v-else />
	</div>
</template>
