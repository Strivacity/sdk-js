# Widgets

Widgets are reusable Angular components for building forms and interactive elements. They are customizable and flexible for various use cases.

## Layout Widget

The Layout Widget lets you create custom layouts for your forms.

### Properties

- `formId`: The form ID.
- `type`: Layout type (e.g. `'vertical'`, `'horizontal'`).
- `tag`: HTML tag (default: `'div'`).

### How to customize

```typescript
@Component({
	selector: 'custom-layout-widget',
	template: `
		<ng-container *ngIf="formId === 'identifier'; else otherLayout">
			<h1>Identifier Form</h1>
			<ng-content></ng-content>
		</ng-container>
		<ng-template #otherLayout>
			<ng-content></ng-content>
		</ng-template>
	`,
})
export class CustomLayoutWidget {
	@Input() formId!: string;
}
```

## Static Widget

Displays static content (text or HTML).

### Properties

- `formId`: The form ID.
- `config`: Static widget config.

### How to customize

```typescript
@Component({
	selector: 'custom-static-widget',
	template: `
		<ng-container *ngIf="config.type === 'text'; else htmlStatic">
			<ng-container *ngIf="formId === 'identifier'; else defaultStatic">
				<p>Identifier Form Static Text</p>
				<p>{{ config.value }}</p>
			</ng-container>
			<ng-template #defaultStatic>
				<div>{{ config.value }}</div>
			</ng-template>
		</ng-container>
		<ng-template #htmlStatic>
			<div [innerHTML]="config.value"></div>
		</ng-template>
	`,
})
export class CustomStaticWidget {
	@Input() formId!: string;
	@Input() config!: any;
}
```

## Input Widget

Input field for text, email, number, etc.

### Properties

- `formId`: The form ID.
- `config`: Input widget config.

### How to customize

```typescript
@Component({
	selector: 'custom-input-widget',
	template: `
		<ng-container *ngIf="formId === 'identifier'; else defaultInput">
			<label [for]="config.id">{{ config.label || 'Identifier Input' }}</label>
			<input
				[id]="config.id"
				[type]="config.inputmode"
				[value]="config.value"
				[placeholder]="config.placeholder"
				[readonly]="config.readonly"
				[autocomplete]="config.autocomplete"
				[pattern]="config.validator?.regex"
				[minlength]="config.validator?.minLength"
				[maxlength]="config.validator?.maxLength"
				[required]="config.validator?.required"
				(change)="onChange($event)"
			/>
			<div>Additional text for identifier input</div>
		</ng-container>
		<ng-template #defaultInput>
			<label [for]="config.id">{{ config.label || 'Input' }}</label>
			<input
				[id]="config.id"
				[type]="config.inputmode"
				[value]="config.value"
				[placeholder]="config.placeholder"
				[readonly]="config.readonly"
				[autocomplete]="config.autocomplete"
				[pattern]="config.validator?.regex"
				[minlength]="config.validator?.minLength"
				[maxlength]="config.validator?.maxLength"
				[required]="config.validator?.required"
				(change)="onChange($event)"
			/>
		</ng-template>
	`,
})
export class CustomInputWidget {
	@Input() formId!: string;
	@Input() config!: any;
	onChange(event: Event) {
		// handle change
	}
}
```

## Submit Widget

### Properties

- `formId`: The form ID.
- `config`: Submit widget config.

### How to customize

```typescript
@Component({
	selector: 'custom-submit-widget',
	template: `
		<ng-container *ngIf="config.render.type === 'button'; else linkSubmit">
			<ng-container *ngIf="formId === 'identifier'; else defaultButton">
				<button [id]="config.id" [style.color]="config.render.textColor" [style.backgroundColor]="config.render.bgColor">
					{{ config.label }}
				</button>
				<div>Additional text for identifier form submit button</div>
			</ng-container>
			<ng-template #defaultButton>
				<button [id]="config.id" [style.color]="config.render.textColor" [style.backgroundColor]="config.render.bgColor">
					{{ config.label }}
				</button>
			</ng-template>
		</ng-container>
		<ng-template #linkSubmit>
			<a [id]="config.id" [style.color]="config.render.textColor">
				{{ formId === 'additionalActions/registration' && config.id === 'submit' ? 'Register now' : config.label }}
			</a>
		</ng-template>
	`,
})
export class CustomSubmitWidget {
	@Input() formId!: string;
	@Input() config!: any;
}
```

## Checkbox Widget

Checkbox input.

### Properties

- `formId`: The form ID.
- `config`: Checkbox widget config.

### How to customize

```typescript
@Component({
	selector: 'custom-checkbox-widget',
	template: `
		<ng-container *ngIf="formId === 'identifier'; else defaultCheckbox">
			<input [id]="config.id" type="checkbox" [checked]="!!config.value" [readonly]="config.readonly" [required]="config.validator?.required" />
			<label *ngIf="config.label" [for]="config.id">{{ config.label }}</label>
			<div>Extra info for identifier checkbox</div>
		</ng-container>
		<ng-template #defaultCheckbox>
			<input [id]="config.id" type="checkbox" [checked]="!!config.value" [readonly]="config.readonly" [required]="config.validator?.required" />
			<label *ngIf="config.label" [for]="config.id">{{ config.label }}</label>
		</ng-template>
	`,
})
export class CustomCheckboxWidget {
	@Input() formId!: string;
	@Input() config!: any;
}
```

## Date Widget

Date input field (native or custom fieldset).

### Properties

- `formId`: The form ID.
- `config`: Date widget config.

### How to customize

```typescript
@Component({
	selector: 'custom-date-widget',
	template: `
		<ng-container *ngIf="formId === 'identifier'; else defaultDate">
			<input
				[id]="config.id"
				type="date"
				[value]="config.value"
				[readonly]="config.readonly"
				[required]="config.validator?.required"
				[placeholder]="config.placeholder"
			/>
			<div>Extra info for identifier date field</div>
		</ng-container>
		<ng-template #defaultDate>
			<input
				[id]="config.id"
				type="date"
				[value]="config.value"
				[readonly]="config.readonly"
				[required]="config.validator?.required"
				[placeholder]="config.placeholder"
			/>
		</ng-template>
	`,
})
export class CustomDateWidget {
	@Input() formId!: string;
	@Input() config!: any;
}
```

## Password Widget

Password input field.

### Properties

- `formId`: The form ID.
- `config`: Password widget config.

### How to customize

```typescript
@Component({
	selector: 'custom-password-widget',
	template: `
		<ng-container *ngIf="formId === 'identifier'; else defaultPassword">
			<input
				[id]="config.id"
				type="password"
				[readonly]="config.readonly"
				[required]="config.validator?.minLength !== undefined"
				[minlength]="config.validator?.minLength"
				[maxlength]="config.validator?.maxLength"
			/>
			<div>Password requirements for identifier form</div>
		</ng-container>
		<ng-template #defaultPassword>
			<input
				[id]="config.id"
				type="password"
				[readonly]="config.readonly"
				[required]="config.validator?.minLength !== undefined"
				[minlength]="config.validator?.minLength"
				[maxlength]="config.validator?.maxLength"
			/>
		</ng-template>
	`,
})
export class CustomPasswordWidget {
	@Input() formId!: string;
	@Input() config!: any;
}
```

## Passcode Widget

Numeric code input.

### Properties

- `formId`: The form ID.
- `config`: Passcode widget config.

### How to customize

```typescript
@Component({
	selector: 'custom-passcode-widget',
	template: `
		<ng-container *ngIf="formId === 'identifier'; else defaultPasscode">
			<input
				[id]="config.id"
				type="text"
				inputmode="numeric"
				[minlength]="config.validator?.length"
				[maxlength]="config.validator?.length"
				autocomplete="off"
			/>
			<div>Extra info for identifier passcode</div>
		</ng-container>
		<ng-template #defaultPasscode>
			<input
				[id]="config.id"
				type="text"
				inputmode="numeric"
				[minlength]="config.validator?.length"
				[maxlength]="config.validator?.length"
				autocomplete="off"
			/>
		</ng-template>
	`,
})
export class CustomPasscodeWidget {
	@Input() formId!: string;
	@Input() config!: any;
}
```

## Phone Widget

Phone number input field.

### Properties

- `formId`: The form ID.
- `config`: Phone widget config.

### How to customize

```typescript
@Component({
	selector: 'custom-phone-widget',
	template: `
		<ng-container *ngIf="formId === 'identifier'; else defaultPhone">
			<input [id]="config.id" type="tel" [value]="config.value" [readonly]="config.readonly" [required]="config.validator?.required" autocomplete="tel" />
			<div>Extra info for identifier phone field</div>
		</ng-container>
		<ng-template #defaultPhone>
			<input [id]="config.id" type="tel" [value]="config.value" [readonly]="config.readonly" [required]="config.validator?.required" autocomplete="tel" />
		</ng-template>
	`,
})
export class CustomPhoneWidget {
	@Input() formId!: string;
	@Input() config!: any;
}
```

## Select Widget

Dropdown or radio group selection.

### Properties

- `formId`: The form ID.
- `config`: Select widget config.

### How to customize

```typescript
@Component({
	selector: 'custom-select-widget',
	template: `
		<ng-container *ngIf="formId === 'identifier'; else defaultSelect">
			<select [id]="config.id" [required]="config.validator?.required">
				<ng-container *ngFor="let option of config.options">
					<optgroup *ngIf="option.type === 'group'" [label]="option.label">
						<option *ngFor="let sub of option.options" [value]="sub.value">{{ sub.label }}</option>
					</optgroup>
					<option *ngIf="option.type !== 'group'" [value]="option.value">{{ option.label }}</option>
				</ng-container>
			</select>
			<div>Extra info for identifier select</div>
		</ng-container>
		<ng-template #defaultSelect>
			<select [id]="config.id" [required]="config.validator?.required">
				<ng-container *ngFor="let option of config.options">
					<optgroup *ngIf="option.type === 'group'" [label]="option.label">
						<option *ngFor="let sub of option.options" [value]="sub.value">{{ sub.label }}</option>
					</optgroup>
					<option *ngIf="option.type !== 'group'" [value]="option.value">{{ option.label }}</option>
				</ng-container>
			</select>
		</ng-template>
	`,
})
export class CustomSelectWidget {
	@Input() formId!: string;
	@Input() config!: any;
}
```

## MultiSelect Widget

Multiple selection (checkboxes or dropdown).

### Properties

- `formId`: The form ID.
- `config`: MultiSelect widget config.

### How to customize

```typescript
@Component({
	selector: 'custom-multiselect-widget',
	template: `
		<ng-container *ngIf="formId === 'identifier'; else defaultMultiSelect">
			<ng-container *ngFor="let option of config.options">
				<div *ngIf="option.type === 'group'">
					<p>{{ option.label }}</p>
					<label *ngFor="let sub of option.options">
						<input type="checkbox" [value]="sub.value" />
						{{ sub.label }}
					</label>
				</div>
				<label *ngIf="option.type !== 'group'">
					<input type="checkbox" [value]="option.value" />
					{{ option.label }}
				</label>
			</ng-container>
			<div>Extra info for identifier multi-select</div>
		</ng-container>
		<ng-template #defaultMultiSelect>
			<ng-container *ngFor="let option of config.options">
				<div *ngIf="option.type === 'group'">
					<p>{{ option.label }}</p>
					<label *ngFor="let sub of option.options">
						<input type="checkbox" [value]="sub.value" />
						{{ sub.label }}
					</label>
				</div>
				<label *ngIf="option.type !== 'group'">
					<input type="checkbox" [value]="option.value" />
					{{ option.label }}
				</label>
			</ng-container>
		</ng-template>
	`,
})
export class CustomMultiSelectWidget {
	@Input() formId!: string;
	@Input() config!: any;
}
```

## Loading Widget

Animated loading icon.

### Properties

- `diameter`: Icon diameter (default: 80).
- `stroke`: Stroke width (default: 2.5).

### Example

```typescript
@Component({
	selector: 'custom-loading-widget',
	template: `
		<app-loading-widget [diameter]="60" [stroke]="3"></app-loading-widget>
	`,
})
export class CustomLoadingWidget {}
```
