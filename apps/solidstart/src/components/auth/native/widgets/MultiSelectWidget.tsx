import type { MultiSelectWidget } from '@strivacity/sdk-solid/client';
import { createMemo, onSettled } from 'solid-js';
import { useNativeLoginContext } from '@strivacity/sdk-solid/client';

export default function MultiSelect(props: { formId: string; config: MultiSelectWidget }) {
	const ctx = useNativeLoginContext();
	const value = createMemo(() => (ctx.forms()[props.formId]?.[props.config.id] as string) || props.config.value);
	const selectedValues = createMemo(() => (ctx.forms()[props.formId]?.[props.config.id] as Array<string>) ?? []);
	const disabled = createMemo(() => ctx.loading() || !!props.config.readonly);
	const errorMessage = createMemo(() => ctx.messages()[props.formId]?.[props.config.id]?.text);

	onSettled(() => {
		if (value()) {
			ctx.setFormValue(props.formId, props.config.id, value());
		}
	});

	function onChange(event: Event) {
		if (disabled()) {
			return;
		}

		const values = selectedValues();
		const optionValue = (event.currentTarget as HTMLInputElement).value;

		ctx.setFormValue(props.formId, props.config.id, values.includes(optionValue) ? values.filter((v) => v !== optionValue) : [...values, optionValue]);
	}

	return (
		<div data-widget="multiselect" data-form-id={props.formId} data-widget-id={props.config.id}>
			{props.config.options.map((option) => (
				<div class="item">
					{option.type === 'group' ? (
						<>
							<p>{option.label}</p>
							{option.options.map((subOption) => (
								<div>
									<input
										id={subOption.value}
										type="checkbox"
										name={props.config.id}
										value={subOption.value}
										checked={selectedValues().includes(subOption.value)}
										onChange={onChange}
									/>
									<label for={subOption.value}>{subOption.label}</label>
								</div>
							))}
						</>
					) : (
						<>
							<input
								id={option.value}
								type="checkbox"
								name={props.config.id}
								value={option.value}
								checked={selectedValues().includes(option.value)}
								onChange={onChange}
							/>
							<label for={option.value}>{option.label}</label>
						</>
					)}
				</div>
			))}
			{errorMessage() && <small class="error">{errorMessage()}</small>}
		</div>
	);
}
