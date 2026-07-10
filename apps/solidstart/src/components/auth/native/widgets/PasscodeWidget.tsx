import type { PasscodeWidget } from '@strivacity/sdk-solid/client';
import { createMemo, onSettled } from 'solid-js';
import { useNativeLoginContext } from '@strivacity/sdk-solid/client';

export default function Passcode(props: { formId: string; config: PasscodeWidget }) {
	const ctx = useNativeLoginContext();
	const value = createMemo(() => ctx.forms()[props.formId]?.[props.config.id] as string);
	const disabled = createMemo(() => ctx.loading());
	const errorMessage = createMemo(() => ctx.messages()[props.formId]?.[props.config.id]?.text);
	const validator = createMemo(() => props.config.validator);

	onSettled(() => {
		if (value()) {
			ctx.setFormValue(props.formId, props.config.id, value());
		}
	});

	function onInput(event: InputEvent) {
		const input = event.currentTarget as HTMLInputElement;
		input.value = input.value.replace(/\D/g, '');
	}

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
		<div data-widget="passcode" data-form-id={props.formId} data-widget-id={props.config.id}>
			{props.config.label && (
				<label for={props.config.id} class="label">
					{props.config.label}
				</label>
			)}
			<input
				id={props.config.id}
				name={props.config.id}
				type={props.config.type}
				readonly={disabled()}
				minlength={validator()?.length}
				maxlength={validator()?.length}
				autocomplete="off"
				inputmode="numeric"
				size={1}
				onInput={onInput}
				onChange={onChange}
				onKeyDown={onKeyDown}
			/>
			{errorMessage() && <small class="error">{errorMessage()}</small>}
		</div>
	);
}
