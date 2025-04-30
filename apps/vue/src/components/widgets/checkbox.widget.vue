<script lang="ts" setup>
import type { CheckboxWidget } from '@strivacity/sdk-core';
import type { LoginContext } from '@strivacity/sdk-vue';
import { computed, inject } from 'vue';

const props = defineProps<{ formId: string; config: CheckboxWidget }>();
const loginContext = inject<LoginContext>('loginContext');
const disabled = computed(() => !!loginContext?.loading.value);
const errorMessage = computed(() => loginContext?.messageContexts.value[props.formId]?.[props.config.id]?.text);
const validator = computed(() => props.config.validator);

function onChange(event: Event) {
	if (disabled.value) {
		return;
	}

	loginContext?.setFormState(props.formId, props.config.id, (event.target as HTMLInputElement).checked);
}
</script>

<template>
	<div>
		<div>
			<input
				:id="config.id"
				:name="config.id"
				:readonly="config.readonly"
				:required="validator?.required"
				type="checkbox"
				size="1"
				@change="onChange($event)"
			/>
			<label v-if="config.label" :for="config.id" class="label">{{ config.label }}</label>
		</div>
		<small v-if="errorMessage" class="error">{{ errorMessage }}</small>
	</div>
</template>

<style lang="scss">
[data-widget='checkbox'] {
	display: flex;
	flex-direction: column;
	margin-block-start: 1rem;

	.label {
		margin-block-end: 0.25rem;
	}

	input {
		transform: scale(1.4);
		margin-inline-end: 0.5rem;
		accent-color: #5d21ab;
		outline-color: #5d21ab;

		&:disabled {
			background: hsl(0deg 0% 98%);
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
