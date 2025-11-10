<script lang="ts" setup>
import type { NativeFlowContextValue, MultiSelectWidget } from '@strivacity/sdk-nuxt';

const props = defineProps<{ formId: string; config: MultiSelectWidget }>();
const context = inject<NativeFlowContextValue>('nativeFlowContext');
const disabled = computed(() => !!context?.loading.value || !!props.config.readonly);
const errorMessage = computed(() => context?.messages.value[props.formId]?.[props.config.id]?.text);

function onChange(event: Event) {
	if (disabled.value) {
		return;
	}

	const values = (context?.forms.value[props.formId]?.[props.config.id] as Array<string>) || [];
	const value = (event.target as HTMLInputElement).value;

	context?.setFormValue(props.formId, props.config.id, values.includes(value) ? values.filter((v: string) => v !== value) : [...values, value]);
}
</script>

<template>
	<div data-widget="multiselect" :data-form-id="formId" :data-widget-id="config.id">
		<div v-for="option in config.options" :key="option.label" class="item">
			<template v-if="option.type === 'group'">
				<p>{{ option.label }}</p>
				<div v-for="subOption in option.options" :key="subOption.value">
					<input
						:id="subOption.value"
						type="checkbox"
						:name="config.id"
						:value="subOption.value"
						:checked="subOption.value === context?.forms.value[formId]?.[config.id]"
						@change="onChange($event)"
					/>
					<label :for="subOption.value">{{ subOption.label }}</label>
				</div>
			</template>
			<template v-else>
				<input
					:id="option.value"
					type="checkbox"
					:name="config.id"
					:value="option.value"
					:checked="option.value === context?.forms.value[formId]?.[config.id]"
					@change="onChange($event)"
				/>
				<label :for="option.value">{{ option.label }}</label>
			</template>
		</div>
		<small v-if="errorMessage" class="error">{{ errorMessage }}</small>
	</div>
</template>

<style lang="scss" scoped>
[data-widget='multiselect'] {
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

	.item + .item {
		margin-block-start: 0.5rem;
	}
}
</style>
