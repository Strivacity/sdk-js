import type { SelectWidget } from '@strivacity/sdk-solid/client';
import { createMemo, onSettled, Show } from 'solid-js';
import { useNativeLoginContext } from '@strivacity/sdk-solid/client';

export default function Select(props: { formId: string; config: SelectWidget }) {
	const ctx = useNativeLoginContext();
	const value = createMemo(() => (ctx.forms()[props.formId]?.[props.config.id] as string) || props.config.value);
	const disabled = createMemo(() => ctx.loading() || !!props.config.readonly);
	const errorMessage = createMemo(() => ctx.messages()[props.formId]?.[props.config.id]?.text);
	const validator = createMemo(() => props.config.validator);

	onSettled(() => {
		if (value()) {
			ctx.setFormValue(props.formId, props.config.id, value());
		}
	});

	function onChange(event: Event) {
		if (disabled()) {
			return;
		}

		ctx.setFormValue(props.formId, props.config.id, (event.currentTarget as HTMLInputElement | HTMLSelectElement).value);
	}

	return (
		<Show
			when={props.config.render?.type === 'radio'}
			fallback={
				<div data-widget="select" data-form-id={props.formId} data-widget-id={props.config.id}>
					{props.config.label && (
						<label for={props.config.id} class="label">
							{props.config.label}
						</label>
					)}
					<select
						id={props.config.id}
						name={props.config.id}
						disabled={disabled()}
						required={validator()?.required}
						size={1}
						value={value()}
						onChange={onChange}
					>
						{props.config.options.map((option) =>
							option.type === 'group' ? (
								<optgroup label={option.label}>
									{option.options.map((subOption) => (
										<option value={subOption.value}>{subOption.label}</option>
									))}
								</optgroup>
							) : (
								<option value={option.value}>{option.label}</option>
							),
						)}
					</select>
					{errorMessage() && <small class="error">{errorMessage()}</small>}
				</div>
			}
		>
			<div data-widget="select" data-form-id={props.formId} data-widget-id={props.config.id}>
				{props.config.options.map((option) => (
					<div class="group">
						{option.type === 'group' ? (
							<>
								<p>{option.label}</p>
								{option.options.map((subOption) => (
									<div class="item">
										<input
											id={subOption.value}
											type="radio"
											name={props.config.id}
											readonly={disabled()}
											value={subOption.value}
											checked={subOption.value === value()}
											onChange={onChange}
										/>
										<label for={subOption.value}>{subOption.label}</label>
									</div>
								))}
							</>
						) : (
							<div class="item">
								<input id={option.value} type="radio" name={props.config.id} value={option.value} checked={option.value === value()} onChange={onChange} />
								<label for={option.value}>{option.label}</label>
							</div>
						)}
					</div>
				))}
				{errorMessage() && <small class="error">{errorMessage()}</small>}
			</div>
		</Show>
	);
}
