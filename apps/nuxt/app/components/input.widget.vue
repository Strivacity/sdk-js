<script lang="ts" setup>
import type { InputWidget } from '@strivacity/sdk-core';
import type { NativeFlowContextValue } from '@strivacity/sdk-nuxt';

const props = defineProps<{ formId: string; config: InputWidget }>();
const context = inject<NativeFlowContextValue>('nativeFlowContext');
const disabled = computed(() => !!context?.loading.value || !!props.config.readonly);
const errorMessage = computed(() => context?.messages.value[props.formId]?.[props.config.id]?.text);
const validator = computed(() => props.config.validator);
const autocomplete = computed(() => {
	if (props.config.autocomplete && props.config.render?.autocompleteHint) {
		return `${props.config.autocomplete} ${props.config.render.autocompleteHint}`;
	} else if (props.config.autocomplete) {
		return props.config.autocomplete;
	} else {
		return 'on';
	}
});
const value = computed(() => (context?.forms.value[props.formId]?.[props.config.id] as string) ?? props.config.value ?? '');

onMounted(() => {
	// Default value handling
	if (value.value.length > 0) {
		context?.setFormValue(props.formId, props.config.id, value.value);
	}
});

function onChange(event: Event) {
	if (disabled.value) {
		return;
	}

	context?.setFormValue(props.formId, props.config.id, (event.target as HTMLInputElement).value);
}

async function onKeyDown(event: KeyboardEvent) {
	if (disabled.value) {
		return;
	}

	const input = event.target as HTMLInputElement;

	if (input.reportValidity()) {
		context?.setFormValue(props.formId, props.config.id, (event.target as HTMLInputElement).value);
		await context?.submitForm(props.formId);
	}
}
</script>

<template>
	<div data-widget="input" :data-form-id="formId" :data-widget-id="config.id">
		<label v-if="config.label" :for="config.id" class="label">{{ config.label }}</label>
		<input
			:id="config.id"
			:name="config.id"
			:autocomplete="autocomplete"
			:inputmode="config.inputmode"
			:readonly="disabled"
			:required="validator?.required"
			:minlength="validator?.minLength"
			:maxlength="validator?.maxLength"
			:pattern="validator?.regex"
			:value="value"
			type="text"
			size="1"
			@change="onChange($event)"
			@keydown.enter.stop="onKeyDown($event)"
		/>
		<small v-if="errorMessage" class="error">{{ errorMessage }}</small>
	</div>
</template>

<style lang="scss" scoped>
[data-widget='input'] {
	display: flex;
	flex-direction: column;
	margin-block-start: 1rem;

	.label {
		margin-block-end: 0.25rem;
	}

	input {
		position: relative;
		display: flex;
		align-items: center;
		height: 2.5rem;
		padding-inline: 0.5rem;
		font-size: 1rem;
		background: hsl(0deg 0% 100%);
		border-width: 1px;
		border-style: solid;
		border-color: hsl(0deg 0% 90%);
		border-radius: 4px;
		box-shadow: rgb(0 0 0 / 5%) 0 1px 2px 0;
		transition:
			color 150ms ease-in-out,
			background 150ms ease-in-out,
			border-color 150ms ease-in-out;

		&:focus {
			outline: none;
			border-color: #5d21ab;
		}

		&:read-only {
			color: hsl(0deg 0% 50%);
			border-color: hsl(0deg 0% 90%);
			cursor: not-allowed;
		}
	}

	.error {
		margin-block-start: 0.25rem;
		color: #e40c0c;
	}
}
</style>
