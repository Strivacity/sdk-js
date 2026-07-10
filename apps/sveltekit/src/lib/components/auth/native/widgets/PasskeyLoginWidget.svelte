<script lang="ts">
	import type { PasskeyLoginWidget } from '@strivacity/sdk-svelte/client';
	import { useNativeLoginContext } from '@strivacity/sdk-svelte/client';
	import { assertWebAuthnCredential } from '@strivacity/sdk-core/utils/credentials';

	let { formId, config }: { formId: string; config: PasskeyLoginWidget } = $props();

	const context = useNativeLoginContext();
	const disabled = $derived(context.loading);

	async function onClick() {
		if (disabled) {
			return;
		}

		try {
			const response = await assertWebAuthnCredential(config.assertionOptions);
			context.setFormValue(formId, config.id, response);
			await context.submitForm(formId);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(error);
			alert('Authentication failed. Please try again.');
		}
	}
</script>

{#if config.render?.type === 'button'}
	<button
		type="button"
		disabled={disabled}
		data-widget="passkeyLogin"
		data-type="button"
		data-form-id={formId}
		data-widget-id={config.id}
		onclick={(e) => {
			e.preventDefault();
			void onClick();
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				void onClick();
			}
		}}
	>
		{config.label}
	</button>
{:else}
	<!-- svelte-ignore a11y_missing_attribute -->
	<a
		data-widget="passkeyLogin"
		data-type="link"
		data-form-id={formId}
		data-widget-id={config.id}
		tabindex="0"
		role="button"
		onclick={(e) => {
			e.preventDefault();
			void onClick();
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				void onClick();
			}
		}}
	>
		{config.label}
	</a>
{/if}
