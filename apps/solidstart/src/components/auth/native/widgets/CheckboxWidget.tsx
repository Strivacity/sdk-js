import type { CheckboxWidget } from '@strivacity/sdk-solid/client';
import { createMemo, onSettled } from 'solid-js';
import { useNativeLoginContext } from '@strivacity/sdk-solid/client';

export default function Checkbox(props: { formId: string; config: CheckboxWidget }) {
	const ctx = useNativeLoginContext();
	const disabled = createMemo(() => ctx.loading() || !!props.config.readonly);
	const checked = createMemo(() => (ctx.forms()[props.formId]?.[props.config.id] as boolean | undefined) ?? props.config.value ?? false);
	const errorMessage = createMemo(() => ctx.messages()[props.formId]?.[props.config.id]?.text);

	onSettled(() => {
		ctx.setFormValue(props.formId, props.config.id, checked());
	});

	function onChange(event: Event) {
		if (disabled()) {
			return;
		}

		ctx.setFormValue(props.formId, props.config.id, (event.currentTarget as HTMLInputElement).checked);
	}

	return (
		<div data-widget="checkbox" data-form-id={props.formId} data-widget-id={props.config.id}>
			<div>
				<input
					id={props.config.id}
					name={props.config.id}
					disabled={disabled()}
					required={props.config.validator?.required}
					checked={checked()}
					type="checkbox"
					size={1}
					onChange={onChange}
				/>
				{props.config.label && (
					<label for={props.config.id} class="label">
						{props.config.label}
					</label>
				)}
			</div>
			{errorMessage() && <small class="error">{errorMessage()}</small>}
		</div>
	);
}
