import type { MultiSelectWidget } from '@strivacity/sdk-solid/client';
import { createEffect, createMemo, onSettled } from 'solid-js';
import { useNativeLoginContext } from '@strivacity/sdk-solid/client';

export default function MultiSelect(props: { formId: string; config: MultiSelectWidget }) {
	const ctx = useNativeLoginContext();
	const selectedValues = createMemo(() => (ctx.forms()[props.formId]?.[props.config.id] as Array<string> | undefined) ?? []);
	const disabled = createMemo(() => ctx.loading() || !!props.config.readonly);
	const errorMessage = createMemo(() => ctx.messages()[props.formId]?.[props.config.id]?.text);
	const minSelectable = createMemo(() => props.config.validator?.minSelectable ?? 0);
	const maxSelectable = createMemo(() => props.config.validator?.maxSelectable ?? Infinity);

	let container: HTMLDivElement | undefined;

	onSettled(() => {
		const value = (ctx.forms()[props.formId]?.[props.config.id] as Array<string> | undefined) ?? props.config.value;

		if (value) {
			ctx.setFormValue(props.formId, props.config.id, value);
		}
	});

	createEffect(
		() => (selectedValues().length < minSelectable() ? `Select at least ${minSelectable()} option(s).` : ''),
		(message) => {
			container?.querySelector('input')?.setCustomValidity(message);
		},
	);

	function isDisabled(value: string) {
		return disabled() || (!selectedValues().includes(value) && selectedValues().length >= maxSelectable());
	}

	function onChange(event: Event) {
		const optionValue = (event.currentTarget as HTMLInputElement).value;

		if (isDisabled(optionValue)) {
			return;
		}

		const values = selectedValues();

		ctx.setFormValue(props.formId, props.config.id, values.includes(optionValue) ? values.filter((v) => v !== optionValue) : [...values, optionValue]);
	}

	return (
		<div ref={(el) => (container = el)} data-widget="multiselect" data-form-id={props.formId} data-widget-id={props.config.id}>
			{props.config.options.map((option) => (
				<div class="item">
					{option.type === 'group' ? (
						<>
							<p>{option.label}</p>
							{option.options.map((subOption) => (
								<div>
									<input
										id={`${props.config.id}-${subOption.value}`}
										type="checkbox"
										name={props.config.id}
										value={subOption.value}
										disabled={isDisabled(subOption.value)}
										checked={selectedValues().includes(subOption.value)}
										onChange={onChange}
									/>
									<label for={`${props.config.id}-${subOption.value}`}>{subOption.label}</label>
								</div>
							))}
						</>
					) : (
						<>
							<input
								id={`${props.config.id}-${option.value}`}
								type="checkbox"
								name={props.config.id}
								value={option.value}
								disabled={isDisabled(option.value)}
								checked={selectedValues().includes(option.value)}
								onChange={onChange}
							/>
							<label for={`${props.config.id}-${option.value}`}>{option.label}</label>
						</>
					)}
				</div>
			))}
			{errorMessage() && <small class="error">{errorMessage()}</small>}
		</div>
	);
}
