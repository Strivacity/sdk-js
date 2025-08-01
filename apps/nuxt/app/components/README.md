# Widgets

Widgets are reusable components that can be used to build forms and other interactive elements in your application. They can be customized to fit the specific needs of your forms. These widgets are designed to be flexible and can be used in various contexts depending on your application's requirements.

## Layout Widget

The Layout Widget is a versatile component that allows you to create custom layouts for your forms.

The fundamental idea is to create a custom layout widget that can render different content based on the form ID. You can use the `formId` prop to conditionally render different layouts or additional content.

### Properties

- `formId`: The ID of the form to which the layout belongs.
- `type`: The type of layout, which can be tag (`form`, `div`, etc.) or a custom layout type.
- `children`: The child components to be rendered within the layout.

### How to customize

```vue
<script setup lang="ts">
import type { LayoutWidget } from '@strivacity/sdk-core';
import type { NativeFlowContextValue } from '@strivacity/sdk-nuxt';

const props = withDefaults(defineProps<{ formId: string; type: LayoutWidget['type']; tag?: string }>(), {
	tag: 'div',
});
const context = inject<NativeFlowContextValue>('nativeFlowContext');
const disabled = computed(() => !!context?.loading.value);

async function onSubmit() {
	if (disabled.value) return;
	await context?.submitForm(props.formId);
}
</script>

<template>
	<component :is="props.tag" data-widget="layout" :data-type="props.type" :data-form-id="props.formId" @submit.prevent="onSubmit()">
		<template v-if="props.formId === 'identifier'">
			<h1>Identifier Form</h1>
			<slot />
		</template>
		<template v-else-if="props.formId === 'other'">
			<h1>Other Form</h1>
			<slot />
		</template>
		<template v-else>
			<slot />
		</template>
	</component>
</template>
```

## Static Widget

The Static Widget is a simple component that displays static content. It can be used to show text, images, or any other static content within your forms.

### Properties

- `formId`: The ID of the form to which the static content belongs.
- `config`: The configuration object for the static widget, which includes:
  - `id`: The unique identifier for the static widget.
  - `type`: The type of the widget. This represents the type of widget.
  - `value`: The value of the static content, which can be a string for text or a URL for images.
  - `render`: Rendering options for the static widget:
    - `type`: The type of static content, such as `'text'` or `'html'`.

### How to customize

```vue
<script setup lang="ts">
import type { StaticWidget } from '@strivacity/sdk-core';
defineProps<{ formId: string; config: StaticWidget }>();
</script>

<template>
	<div v-if="config.render.type === 'html'" data-widget="static" :data-form-id="formId" :data-widget-id="config.id" v-html="config.value"></div>
	<div v-else-if="config.type === 'text' && formId === 'identifier'" data-widget="static" :data-form-id="formId" :data-widget-id="config.id">
		<p>Identifier Form Static Text</p>
		<p>{{ config.value }}</p>
	</div>
	<div v-else data-widget="static" :data-form-id="formId" :data-widget-id="config.id">{{ config.value }}</div>
</template>
```

## Input Widget

The Input Widget is a versatile component that allows you to create input fields for various types of data, such as text, email, number, etc.

### Properties

- `formId`: The ID of the form to which the input belongs.
- `config`: The configuration object for the input widget, which includes:
  - `id`: The unique identifier for the input widget.
  - `type`: The type of the widget, which is always `'input'`.
  - `label`: The label displayed above the input field (optional).
  - `value`: The initial value of the input field (optional).
  - `placeholder`: The placeholder text for the input field (optional).
  - `readonly`: Whether the input field is read-only (optional).
  - `autocomplete`: The autocomplete attribute for the input field (optional).
  - `inputmode`: The input mode for the input field, such as `'text'`, `'numeric'`, etc. (required).
  - `validator`: Validation rules for the input field, which can include:
  - `required`: Whether the input is required (optional).
  - `minLength`: Minimum length of the input (optional).
  - `maxLength`: Maximum length of the input (optional).
  - `regex`: Regular expression for validation (optional).

### How to customize

```vue
<script setup lang="ts">
import type { InputWidget } from '@strivacity/sdk-core';
import type { NativeFlowContextValue } from '@strivacity/sdk-nuxt';

const props = defineProps<{ formId: string; config: InputWidget }>();
const context = inject<NativeFlowContextValue>('nativeFlowContext');
const disabled = computed(() => !!context?.loading.value || !!props.config.readonly);
const validator = computed(() => props.config.validator);

function onChange(event: Event) {
	if (disabled.value) return;
	context?.setFormValue(props.formId, props.config.id, (event.target as HTMLInputElement).value);
}
</script>

<template>
	<label :for="props.config.id">{{ props.config.label }}</label>
	<input
		:id="props.config.id"
		:name="props.config.id"
		:autocomplete="props.config.autocomplete || 'on'"
		:inputmode="props.config.inputmode"
		:readonly="disabled"
		:required="validator?.required"
		:minlength="validator?.minLength"
		:maxlength="validator?.maxLength"
		:pattern="validator?.regex"
		:value="context?.forms.value[props.formId]?.[props.config.id] || props.config.value"
		type="text"
		size="1"
		@change="onChange($event)"
	/>
</template>
```

## Submit Widget

### Properties

- `formId`: The unique identifier for the submit widget.
- `config`: The configuration object for the submit widget, which includes:
  - `id`: The unique identifier for the submit widget.
  - `type`: The type of the widget. This represents the type of widget.
  - `label`: The label displayed on the submit widget.
  - `render`: Rendering options for the submit widget:
    - `type`: The type of submit control, either `'button'` or `'link'`.
    - `textColor`: The text color of the submit control (optional).
    - `bgColor`: The background color of the submit control (optional).
    - `hint`: Optional hint configuration:
      - `icon`: The icon to display with the hint (optional).
      - `variant`: The variant of the hint, such as `'info'`, `'warning'`, etc. (optional).

### How to customize

```vue
<script setup lang="ts">
import type { SubmitWidget } from '@strivacity/sdk-core';
import type { NativeFlowContextValue } from '@strivacity/sdk-nuxt';

const props = defineProps<{ formId: string; config: SubmitWidget }>();
const context = inject<NativeFlowContextValue>('nativeFlowContext');
const disabled = computed(() => !!context?.loading.value);

async function onSubmit(event: Event) {
	if (disabled.value) return;
	const form = (event.target as HTMLElement).closest('form');
	if (form?.dataset.formId === props.formId) {
		form.requestSubmit();
	} else {
		await context?.submitForm(props.formId);
	}
}
</script>

<template>
	<button
		v-if="props.config.render.type === 'button'"
		:disabled="disabled"
		:style="{
			backgroundColor: props.config.render.bgColor,
			color: props.config.render.textColor,
		}"
		data-widget="submit"
		data-type="button"
		:data-form-id="props.formId"
		:data-widget-id="props.config.id"
		@click.prevent="onSubmit($event)"
	>
		{{ props.config.label }}
	</button>
	<a v-else data-widget="submit" data-type="link" :data-form-id="props.formId" :data-widget-id="props.config.id" tabindex="0" @click.prevent="onSubmit($event)">
		{{ props.config.label }}
	</a>
</template>
```

## Checkbox Widget

The Checkbox Widget is a simple component that displays a checkbox input in your form.

### Properties

- `formId`: The form identifier.
- `config`: The widget configuration:
  - `id`: Unique identifier.
  - `type`: Always `'checkbox'`.
  - `label`: Label next to the checkbox (optional).
  - `readonly`: Whether the checkbox is read-only (optional).
  - `value`: Initial value (optional).
  - `render`: Render type (`checkboxHidden` or `checkboxShown`).
  - `validator`: Validation rules (`required`).

### How to customize

```vue
<script setup lang="ts">
import type { CheckboxWidget } from '@strivacity/sdk-core';
import type { NativeFlowContextValue } from '@strivacity/sdk-nuxt';

const props = defineProps<{ formId: string; config: CheckboxWidget }>();
const context = inject<NativeFlowContextValue>('nativeFlowContext');
const disabled = computed(() => !!context?.loading.value);
const validator = computed(() => props.config.validator);

function onChange(event: Event) {
	if (disabled.value) return;
	context?.setFormValue(props.formId, props.config.id, (event.target as HTMLInputElement).checked);
}
</script>

<template>
	<input
		:id="props.config.id"
		:name="props.config.id"
		:disabled="disabled"
		:required="validator?.required"
		:checked="(context?.forms.value[props.formId]?.[props.config.id] as boolean) || props.config.value || false"
		type="checkbox"
		size="1"
		@change="onChange($event)"
	/>
	<label v-if="props.config.label" :for="props.config.id">{{ props.config.label }}</label>
</template>
```

## Date Widget

The Date Widget allows you to display a date input field, either as a native date picker or split into custom fields.

### Properties

- `formId`: The form identifier.
- `config`: The widget configuration:
  - `id`: Unique identifier.
  - `type`: Always `'date'`.
  - `label`: Label (optional).
  - `placeholder`: Placeholder text (optional).
  - `readonly`: Whether the field is read-only (optional).
  - `value`: Initial value (optional).
  - `render`: Render type (`native` or `fieldSet`).
  - `validator`: Validation rules (`notBefore`, `notAfter`, `required`).

### How to customize

```vue
<script setup lang="ts">
import type { DateWidget } from '@strivacity/sdk-core';
import type { NativeFlowContextValue } from '@strivacity/sdk-nuxt';

const props = defineProps<{ formId: string; config: DateWidget }>();
const context = inject<NativeFlowContextValue>('nativeFlowContext');
const validator = computed(() => props.config.validator);

const value = (context?.forms.value[props.formId]?.[props.config.id] as string) || props.config.value;
const disabled = computed(() => !!context?.loading.value || !!props.config.readonly);

function onChange(event: Event) {
	if (disabled.value) return;
	context?.setFormValue(props.formId, props.config.id, (event.target as HTMLInputElement).value);
}
</script>

<template>
	<input
		:id="props.config.id"
		:name="props.config.id"
		type="date"
		:readonly="disabled"
		:required="validator?.required"
		:value="value"
		@change="onChange($event)"
	/>
</template>
```

## Password Widget

The Password Widget displays a password input field, optionally with a quality indicator.

### Properties

- `formId`: The form identifier.
- `config`: The widget configuration:
  - `id`: Unique identifier.
  - `type`: Always `'password'`.
  - `label`: Label (optional).
  - `qualityIndicator`: Password quality indicator (optional).
  - `validator`: Validation rules (`minLength`, `maxLength`, etc.).

### How to customize

```vue
<script setup lang="ts">
import type { PasswordWidget } from '@strivacity/sdk-core';
import type { NativeFlowContextValue } from '@strivacity/sdk-nuxt';

const props = defineProps<{ formId: string; config: PasswordWidget }>();
const context = inject<NativeFlowContextValue>('nativeFlowContext');
const disabled = computed(() => !!context?.loading.value);
const validator = computed(() => props.config.validator);

function onChange(event: Event) {
	if (disabled.value) return;
	context?.setFormValue(props.formId, props.config.id, (event.target as HTMLInputElement).value);
}
</script>

<template>
	<input
		:id="props.config.id"
		:name="props.config.id"
		type="password"
		:readonly="disabled"
		:required="validator?.minLength !== undefined"
		:minlength="validator?.minLength"
		:maxlength="validator?.maxLength"
		@change="onChange($event)"
	/>
</template>
```

## Passcode Widget

The Passcode Widget is a simple numeric code input field.

### Properties

- `formId`: The form identifier.
- `config`: The widget configuration:
  - `id`: Unique identifier.
  - `type`: Always `'passcode'`.
  - `label`: Label (optional).
  - `validator`: Validation rules (`length`).

### How to customize

```vue
<script setup lang="ts">
import type { PasscodeWidget } from '@strivacity/sdk-core';
import type { NativeFlowContextValue } from '@strivacity/sdk-nuxt';

const props = defineProps<{ formId: string; config: PasscodeWidget }>();
const context = inject<NativeFlowContextValue>('nativeFlowContext');
const disabled = computed(() => !!context?.loading.value);
const validator = computed(() => props.config.validator);

function onInput(event: InputEvent) {
	const inputElement = event.target as HTMLInputElement;
	inputElement.value = inputElement.value.replace(/\D/g, '');
}
function onChange(event: Event) {
	if (disabled.value) return;
	context?.setFormValue(props.formId, props.config.id, (event.target as HTMLInputElement).value);
}
</script>

<template>
	<input
		:id="props.config.id"
		:name="props.config.id"
		type="text"
		inputmode="numeric"
		:minlength="validator?.length"
		:maxlength="validator?.length"
		autocomplete="off"
		:readonly="disabled"
		@input="onInput($event as InputEvent)"
		@change="onChange($event)"
	/>
</template>
```

## Phone Widget

The Phone Widget displays a phone number input field.

### Properties

- `formId`: The form identifier.
- `config`: The widget configuration:
  - `id`: Unique identifier.
  - `type`: Always `'phone'`.
  - `label`: Label (optional).
  - `readonly`: Whether the field is read-only (optional).
  - `value`: Initial value (optional).
  - `validator`: Validation rules (`required`).

### How to customize

```vue
<script setup lang="ts">
import type { PhoneWidget } from '@strivacity/sdk-core';
import type { NativeFlowContextValue } from '@strivacity/sdk-nuxt';

const props = defineProps<{ formId: string; config: PhoneWidget }>();
const context = inject<NativeFlowContextValue>('nativeFlowContext');
const disabled = computed(() => !!context?.loading.value || !!props.config.readonly);
const validator = computed(() => props.config.validator);

function onChange(event: Event) {
	if (disabled.value) return;
	context?.setFormValue(props.formId, props.config.id, (event.target as HTMLInputElement).value);
}
</script>

<template>
	<input
		:id="props.config.id"
		:name="props.config.id"
		type="tel"
		autocomplete="tel"
		inputmode="tel"
		:readonly="disabled"
		:required="validator?.required"
		:value="context?.forms.value[props.formId]?.[props.config.id] || props.config.value"
		@change="onChange($event)"
	/>
</template>
```

## Select Widget

The Select Widget is a selection field, which can be rendered as a dropdown or a radio button group.

### Properties

- `formId`: The form identifier.
- `config`: The widget configuration:
  - `id`: Unique identifier.
  - `type`: Always `'select'`.
  - `label`: Label (optional).
  - `readonly`: Whether the field is read-only (optional).
  - `values`: Initial values (optional).
  - `placeholder`: Placeholder text (optional).
  - `render`: Render type (`dropdown` or `radio`).
  - `options`: Selectable options.
  - `validator`: Validation rules (`required`).

### How to customize

```vue
<script setup lang="ts">
import type { SelectWidget } from '@strivacity/sdk-core';
import type { NativeFlowContextValue } from '@strivacity/sdk-nuxt';

const props = defineProps<{ formId: string; config: SelectWidget }>();
const context = inject<NativeFlowContextValue>('nativeFlowContext');
const disabled = computed(() => !!context?.loading.value || !!props.config.readonly);
const validator = computed(() => props.config.validator);

function onChange(event: Event) {
	if (disabled.value) return;
	context?.setFormValue(props.formId, props.config.id, (event.target as HTMLInputElement).value);
}
</script>

<template>
	<select :id="props.config.id" :name="props.config.id" :disabled="disabled" :required="validator?.required" @change="onChange($event)">
		<template v-for="option in props.config.options">
			<optgroup v-if="option.type === 'group'" :label="option.label">
				<option v-for="sub in option.options" :key="sub.value" :value="sub.value">{{ sub.label }}</option>
			</optgroup>
			<option v-else :key="option.value" :value="option.value">{{ option.label }}</option>
		</template>
	</select>
</template>
```

## MultiSelect Widget

The MultiSelect Widget allows selecting multiple options, either as checkboxes or a dropdown.

### Properties

- `formId`: The form identifier.
- `config`: The widget configuration:
  - `id`: Unique identifier.
  - `type`: Always `'multiSelect'`.
  - `label`: Label (optional).
  - `readonly`: Whether the field is read-only (optional).
  - `values`: Initial values (optional).
  - `placeholder`: Placeholder text (optional).
  - `render`: Render type (`dropdown` or `checkbox`).
  - `options`: Selectable options.
  - `validator`: Validation rules (`minSelectable`, `maxSelectable`).

### How to customize

```vue
<script setup lang="ts">
import type { MultiSelectWidget } from '@strivacity/sdk-core';
import type { NativeFlowContextValue } from '@strivacity/sdk-nuxt';

const props = defineProps<{ formId: string; config: any }>();
const context = inject<NativeFlowContextValue>('nativeFlowContext');
const disabled = computed(() => !!context?.loading.value || !!props.config.readonly);

function onChange(event: Event) {
	if (disabled.value) return;
	const values = (context?.forms.value[props.formId]?.[props.config.id] as Array<string>) || [];
	const value = (event.target as HTMLInputElement).value;
	context?.setFormValue(props.formId, props.config.id, values.includes(value) ? values.filter((v: string) => v !== value) : [...values, value]);
}
</script>

<template>
	<div v-if="props.formId === 'identifier'">
		<template v-for="option in props.config.options">
			<div v-if="option.type === 'group'" :key="option.label">
				<p>{{ option.label }}</p>
				<label v-for="sub in option.options" :key="sub.value">
					<input type="checkbox" :value="sub.value" @change="onChange($event)" />
					{{ sub.label }}
				</label>
			</div>
			<label v-else :key="option.value">
				<input type="checkbox" :value="option.value" @change="onChange($event)" />
				{{ option.label }}
			</label>
		</template>
		<div>Extra info for identifier multi-select</div>
	</div>
	<template v-else>
		<template v-for="option in props.config.options">
			<div v-if="option.type === 'group'" :key="option.label">
				<p>{{ option.label }}</p>
				<label v-for="sub in option.options" :key="sub.value">
					<input type="checkbox" :value="sub.value" @change="onChange($event)" />
					{{ sub.label }}
				</label>
			</div>
			<label v-else :key="option.value">
				<input type="checkbox" :value="option.value" @change="onChange($event)" />
				{{ option.label }}
			</label>
		</template>
	</template>
</template>
```

## Loading Widget

The Loading Widget displays an animated loading icon.

### Properties

- `diameter`: The icon diameter (optional, default: 80).
- `stroke`: The stroke width (optional, default: 2.5).

### Example

```vue
<script setup lang="ts">
import LoadingWidget from './loading.widget.vue';
</script>

<template>
	<LoadingWidget :diameter="60" :stroke="3" />
</template>
```
