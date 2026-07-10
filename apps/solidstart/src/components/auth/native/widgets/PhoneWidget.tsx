import type { PhoneWidget } from '@strivacity/sdk-solid/client';
import { createMemo, onSettled } from 'solid-js';
import { useNativeLoginContext } from '@strivacity/sdk-solid/client';

export default function Phone(props: { formId: string; config: PhoneWidget }) {
	const ctx = useNativeLoginContext();
	const value = createMemo(() => (ctx.forms()[props.formId]?.[props.config.id] as string) || props.config.value);
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
		<div data-widget="phone" data-form-id={props.formId} data-widget-id={props.config.id}>
			{props.config.label && (
				<label for={props.config.id} class="label">
					{props.config.label}
				</label>
			)}
			<input
				id={props.config.id}
				name={props.config.id}
				type={props.config.type}
				autocomplete="tel"
				inputmode="tel"
				readonly={disabled()}
				required={props.config.validator?.required}
				value={value() ?? ''}
				size={1}
				onChange={onChange}
				onKeyDown={onKeyDown}
			/>
			{errorMessage() && <small class="error">{errorMessage()}</small>}
		</div>
	);
}
