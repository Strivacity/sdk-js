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

```tsx
import { LayoutWidget } from '@strivacity/sdk-next';

/**
 * This will render a custom layout depending on the `formId`. You can add more complex logic to render different layouts or additional content based on the form ID.
 *
 * For more context, please check the example widget file.
 */
export default function CustomLayoutWidget({
	formId,
	type,
	tag: Tag = 'div',
	children,
}: {
	formId: string;
	type: LayoutWidget['type'];
	tag?: keyof React.JSX.IntrinsicElements;
	children?: React.ReactNode;
}) {
	if (formId === 'identifier') {
		return (
			<Tag>
				<h1>Identifier Form</h1>
				{children}
			</Tag>
		);
	} else {
		return <Tag>{children}</Tag>;
	}
}
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

```tsx
import { StaticWidget } from '@strivacity/sdk-next';

/**
 * This will render a custom static widget depending on the `formId`. You can add more complex logic to render different static content based on the form ID.
 *
 * For more context, please check the example widget file.
 */
export default function CustomStaticWidget({ formId, config }: { formId: string; config: StaticWidget }) {
	if (config.type === 'text') {
		if (formId === 'identifier') {
			return (
				<div>
					<p>Identifier Form Static Text</p>
					<p>{config.value}</p>
				</div>
			);
		} else {
			return <div>{config.value}</div>;
		}
	} else if (config.type === 'html') {
		return <div dangerouslySetInnerHTML={{ __html: config.value }} />;
	}
	return null;
}
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

```tsx
import { InputWidget } from '@strivacity/sdk-next';

/**
 * This will render a custom input widget depending on the `formId`. You can add more complex logic to render different input fields based on the form ID.
 *
 * For more context, please check the example widget file.
 */
export default function CustomInputWidget({ formId, config }: { formId: string; config: InputWidget }) {
	if (formId === 'identifier') {
		return (
			<div>
				<label htmlFor={config.id}>{config.label || 'Identifier Input'}</label>
				<input
					id={config.id}
					type={config.inputmode}
					value={config.value}
					placeholder={config.placeholder}
					readOnly={config.readonly}
					autoComplete={config.autocomplete}
					pattern={config.validator?.regex}
					minLength={config.validator?.minLength}
					maxLength={config.validator?.maxLength}
					required={config.validator?.required}
					onChange={(e) => {
						// Handle input change
						console.log(`Input changed: ${e.target.value}`);
					}}
				/>
				<div>Additional text for identifier input</div>
			</div>
		);
	} else {
		return (
			<div>
				<label htmlFor={config.id}>{config.label || 'Input'}</label>
				<input
					id={config.id}
					type={config.inputmode}
					value={config.value}
					placeholder={config.placeholder}
					readOnly={config.readonly}
					autoComplete={config.autocomplete}
					pattern={config.validator?.regex}
					minLength={config.validator?.minLength}
					maxLength={config.validator?.maxLength}
					required={config.validator?.required}
					onChange={(e) => {
						// Handle input change
						console.log(`Input changed: ${e.target.value}`);
					}}
				/>
			</div>
		);
	}
}
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

```tsx
import { SubmitWidget } from '@strivacity/sdk-next';

/**
 * This will render a custom submit widget depending on the `formId`. You can add more complex logic to render different submit buttons or links based on the form ID.
 *
 * For more context, please check the example widget file.
 */
export default function CustomSubmitWidget({ formId, config }: { formId: string; config: SubmitWidget }) {
	if (config.render.type === 'button') {
		if (formId === 'identifier') {
			return (
				<>
					<button id={config.id} style={{ color: config.render.textColor, backgroundColor: config.render.bgColor }}>
						{config.label}
					</button>
					<div>Additional text for identifier form submit button</div>
				</>
			);
		} else {
			return (
				<button id={config.id} style={{ color: config.render.textColor, backgroundColor: config.render.bgColor }}>
					{config.label}
				</button>
			);
		}
	} else if (config.render.type === 'link') {
		// Custom text for registration submit link
		const linkText = formId === 'additionalActions/registration' && config.id === 'submit' ? 'Register now' : config.label;

		return (
			<a href="#" id={config.id} style={{ color: config.render.textColor }}>
				{linkText}
			</a>
		);
	}
	return null;
}
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

```tsx
import { CheckboxWidget } from '@strivacity/sdk-next';

/**
 * This will render a custom checkbox widget depending on the `formId`. You can add more complex logic to render different checkboxes or additional content based on the form ID.
 *
 * For more context, please check the example widget file.
 */
export default function CustomCheckboxWidget({ formId, config }: { formId: string; config: CheckboxWidget }) {
	if (formId === 'identifier') {
		return (
			<div>
				<input id={config.id} type="checkbox" checked={!!config.value} readOnly={config.readonly} required={config.validator?.required} />
				{config.label && <label htmlFor={config.id}>{config.label}</label>}
				<div>Extra info for identifier checkbox</div>
			</div>
		);
	} else {
		return (
			<div>
				<input id={config.id} type="checkbox" checked={!!config.value} readOnly={config.readonly} required={config.validator?.required} />
				{config.label && <label htmlFor={config.id}>{config.label}</label>}
			</div>
		);
	}
}
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

```tsx
import { DateWidget } from '@strivacity/sdk-next';

/**
 * This will render a custom date widget depending on the `formId`. You can add more complex logic to render different date fields or additional content based on the form ID.
 *
 * For more context, please check the example widget file.
 */
export default function CustomDateWidget({ formId, config }: { formId: string; config: DateWidget }) {
	if (formId === 'identifier') {
		return (
			<div>
				<input
					id={config.id}
					type="date"
					value={config.value}
					readOnly={config.readonly}
					required={config.validator?.required}
					placeholder={config.placeholder}
				/>
				<div>Extra info for identifier date field</div>
			</div>
		);
	} else {
		return (
			<input
				id={config.id}
				type="date"
				value={config.value}
				readOnly={config.readonly}
				required={config.validator?.required}
				placeholder={config.placeholder}
			/>
		);
	}
}
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

```tsx
import { PasswordWidget } from '@strivacity/sdk-next';

/**
 * This will render a custom password widget depending on the `formId`. You can add more complex logic to render different password fields or additional content based on the form ID.
 *
 * For more context, please check the example widget file.
 */
export default function CustomPasswordWidget({ formId, config }: { formId: string; config: PasswordWidget }) {
	if (formId === 'identifier') {
		return (
			<div>
				<input
					id={config.id}
					type="password"
					readOnly={config.readonly}
					required={config.validator?.minLength !== undefined}
					minLength={config.validator?.minLength}
					maxLength={config.validator?.maxLength}
				/>
				<div>Password requirements for identifier form</div>
			</div>
		);
	} else {
		return (
			<input
				id={config.id}
				type="password"
				readOnly={config.readonly}
				required={config.validator?.minLength !== undefined}
				minLength={config.validator?.minLength}
				maxLength={config.validator?.maxLength}
			/>
		);
	}
}
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

```tsx
import { PasscodeWidget } from '@strivacity/sdk-next';

/**
 * This will render a custom passcode widget depending on the `formId`. You can add more complex logic to render different passcode fields or additional content based on the form ID.
 *
 * For more context, please check the example widget file.
 */
export default function CustomPasscodeWidget({ formId, config }: { formId: string; config: PasscodeWidget }) {
	if (formId === 'identifier') {
		return (
			<div>
				<input id={config.id} type="text" inputMode="numeric" minLength={config.validator?.length} maxLength={config.validator?.length} autoComplete="off" />
				<div>Extra info for identifier passcode</div>
			</div>
		);
	} else {
		return (
			<input id={config.id} type="text" inputMode="numeric" minLength={config.validator?.length} maxLength={config.validator?.length} autoComplete="off" />
		);
	}
}
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

```tsx
import { PhoneWidget } from '@strivacity/sdk-next';

/**
 * This will render a custom phone widget depending on the `formId`. You can add more complex logic to render different phone fields or additional content based on the form ID.
 *
 * For more context, please check the example widget file.
 */
export default function CustomPhoneWidget({ formId, config }: { formId: string; config: PhoneWidget }) {
	if (formId === 'identifier') {
		return (
			<div>
				<input id={config.id} type="tel" value={config.value} readOnly={config.readonly} required={config.validator?.required} autoComplete="tel" />
				<div>Extra info for identifier phone field</div>
			</div>
		);
	} else {
		return <input id={config.id} type="tel" value={config.value} readOnly={config.readonly} required={config.validator?.required} autoComplete="tel" />;
	}
}
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

```tsx
import { SelectWidget } from '@strivacity/sdk-next';

/**
 * This will render a custom select widget depending on the `formId`. You can add more complex logic to render different select fields or additional content based on the form ID.
 *
 * For more context, please check the example widget file.
 */
export default function CustomSelectWidget({ formId, config }: { formId: string; config: SelectWidget }) {
	if (formId === 'identifier') {
		return (
			<div>
				<select id={config.id} required={config.validator?.required}>
					{config.options.map((option) =>
						option.type === 'group' ? (
							<optgroup label={option.label}>
								{option.options.map((sub) => (
									<option key={sub.value} value={sub.value}>
										{sub.label}
									</option>
								))}
							</optgroup>
						) : (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						),
					)}
				</select>
				<div>Extra info for identifier select</div>
			</div>
		);
	} else {
		return (
			<select id={config.id} required={config.validator?.required}>
				{config.options.map((option) =>
					option.type === 'group' ? (
						<optgroup label={option.label}>
							{option.options.map((sub) => (
								<option key={sub.value} value={sub.value}>
									{sub.label}
								</option>
							))}
						</optgroup>
					) : (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					),
				)}
			</select>
		);
	}
}
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

```tsx
import { MultiSelectWidget } from '@strivacity/sdk-next';

/**
 * This will render a custom multi-select widget depending on the `formId`. You can add more complex logic to render different multi-select fields or additional content based on the form ID.
 *
 * For more context, please check the example widget file.
 */
export default function CustomMultiSelectWidget({ formId, config }: { formId: string; config: MultiSelectWidget }) {
	if (formId === 'identifier') {
		return (
			<div>
				{config.options.map((option) =>
					option.type === 'group' ? (
						<div key={option.label}>
							<p>{option.label}</p>
							{option.options.map((sub) => (
								<label key={sub.value}>
									<input type="checkbox" value={sub.value} />
									{sub.label}
								</label>
							))}
						</div>
					) : (
						<label key={option.value}>
							<input type="checkbox" value={option.value} />
							{option.label}
						</label>
					),
				)}
				<div>Extra info for identifier multi-select</div>
			</div>
		);
	} else {
		return (
			<>
				{config.options.map((option) =>
					option.type === 'group' ? (
						<div key={option.label}>
							<p>{option.label}</p>
							{option.options.map((sub) => (
								<label key={sub.value}>
									<input type="checkbox" value={sub.value} />
									{sub.label}
								</label>
							))}
						</div>
					) : (
						<label key={option.value}>
							<input type="checkbox" value={option.value} />
							{option.label}
						</label>
					),
				)}
			</>
		);
	}
}
```

## Loading Widget

The Loading Widget displays an animated loading icon.

### Properties

- `diameter`: The icon diameter (optional, default: 80).
- `stroke`: The stroke width (optional, default: 2.5).

### Example

```tsx
import { LoadingWidget } from '@strivacity/sdk-next';

export default function CustomLoadingWidget() {
	return <LoadingWidget diameter={60} stroke={3} />;
}
```
