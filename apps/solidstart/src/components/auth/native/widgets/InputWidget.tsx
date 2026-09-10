import type { InputWidget } from '@strivacity/sdk-solid/client';
import { createMemo, onSettled } from 'solid-js';
import { useNativeLoginContext } from '@strivacity/sdk-solid/client';

export default function Input(props: { formId: string; config: InputWidget }) {
	const ctx = useNativeLoginContext();
	const value = createMemo(() => (ctx.forms()[props.formId]?.[props.config.id] as string) || props.config.value);
	const disabled = createMemo(() => ctx.loading() || !!props.config.readonly);
	const errorMessage = createMemo(() => ctx.messages()[props.formId]?.[props.config.id]?.text);
	const autocomplete = createMemo(() =>
		props.config.autocomplete && props.config.render?.autocompleteHint
			? `${props.config.autocomplete} ${props.config.render.autocompleteHint}`
			: (props.config.autocomplete ?? 'on'),
	);

	onSettled(() => {
		if (value()) {
			ctx.setFormValue(props.formId, props.config.id, value());
		}
	});

	function onChange(event: Event) {
		if (disabled()) {
			return;
		}

		ctx.setFormValue(props.formId, props.config.id, (event.currentTarget as HTMLInputElement).value);
	}

	async function onKeyDown(event: KeyboardEvent) {
		if (disabled() || event.key !== 'Enter') {
			return;
		}

		event.stopPropagation();

		const input = event.currentTarget as HTMLInputElement;

		if (input.reportValidity()) {
			ctx.setFormValue(props.formId, props.config.id, input.value);
			await ctx.submitForm(props.formId);
		}
	}

	return (
		<div data-widget="input" data-form-id={props.formId} data-widget-id={props.config.id}>
			{props.config.label && (
				<label for={props.config.id} class="label">
					{props.config.label}
				</label>
			)}
			<input
				id={props.config.id}
				name={props.config.id}
				autocomplete={autocomplete() as HTMLInputElement['autocomplete']}
				inputmode={props.config.inputmode}
				readonly={disabled()}
				required={props.config.validator?.required}
				minlength={props.config.validator?.minLength}
				maxlength={props.config.validator?.maxLength}
				pattern={props.config.validator?.regex}
				value={value() ?? ''}
				type="text"
				size={1}
				onChange={onChange}
				onKeyDown={onKeyDown}
			/>
			{errorMessage() && <small class="error">{errorMessage()}</small>}
		</div>
	);
}
