<script lang="ts" setup>
import type { SelectWidget } from '@strivacity/sdk-core';
import type { NativeFlowContextValue } from '@strivacity/sdk-nuxt';

const props = defineProps<{ formId: string; config: SelectWidget }>();
const context = inject<NativeFlowContextValue>('nativeFlowContext');
const disabled = computed(() => !!context?.loading.value || !!props.config.readonly);
const errorMessage = computed(() => context?.messages.value[props.formId]?.[props.config.id]?.text);
const validator = computed(() => props.config.validator);

function onChange(event: Event) {
	if (disabled.value) {
		return;
	}

	context?.setFormValue(props.formId, props.config.id, (event.target as HTMLInputElement).value);
}
</script>

<template>
	<div data-widget="select" :data-form-id="formId" :data-widget-id="config.id">
		<template v-if="config.render.type === 'radio'">
			<div v-for="option in config.options" :key="option.label" class="item">
				<template v-if="option.type === 'group'">
					<p>{{ option.label }}</p>
					<div v-for="subOption in option.options" :key="subOption.value" class="item">
						<input
							:id="subOption.value"
							type="radio"
							:name="config.id"
							:readonly="disabled"
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
						type="radio"
						:name="config.id"
						:value="option.value"
						:checked="option.value === context?.forms.value[formId]?.[config.id]"
						@change="onChange($event)"
					/>
					<label :for="option.value">{{ option.label }}</label>
				</template>
			</div>
			<small v-if="errorMessage" class="error">{{ errorMessage }}</small>
		</template>
		<template v-else>
			<label v-if="config.label" :for="config.id" class="label">{{ config.label }}</label>
			<select :id="config.id" :name="config.id" :disabled="disabled" :required="validator?.required" size="1" @change="onChange($event)">
				<template v-for="option in config.options" :key="option.label">
					<optgroup v-if="option.type === 'group'" :label="option.label">
						<option
							v-for="subOption in option.options"
							:key="subOption.value"
							:value="subOption.value"
							:selected="subOption.value === context?.forms.value[formId]?.[config.id]"
						>
							{{ subOption.label }}
						</option>
					</optgroup>
					<option v-else :value="option.value" :selected="option.value === context?.forms.value[formId]?.[config.id]">
						{{ option.label }}
					</option>
				</template>
			</select>
			<small v-if="errorMessage" class="error">{{ errorMessage }}</small>
		</template>
	</div>
</template>

<style lang="scss" scoped>
[data-widget='select'] {
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
	}

	.item {
		display: flex;
		align-items: center;
	}

	.error {
		margin-block-start: 0.25rem;
		color: #e40c0c;
	}
}
</style>
