<script lang="ts">
	import type { SubmitWidget } from '@strivacity/sdk-svelte/client';
	import { useNativeLoginContext } from '@strivacity/sdk-svelte/client';

	let { formId, config }: { formId: string; config: SubmitWidget } = $props();

	const context = useNativeLoginContext();
	const disabled = $derived(context.loading);

	async function onSubmit(event: Event) {
		if (disabled) {
			return;
		}

		const form = (event.target as HTMLElement).closest('form');

		if (form?.dataset.formId === formId) {
			form.requestSubmit();
		} else {
			await context.submitForm(formId);
		}
	}
</script>

{#if config.render?.type === 'button'}
	<button
		type="submit"
		disabled={disabled}
		style:background-color={config.render.bgColor ?? (config.render.hint?.variant === 'primary' ? `#5d21ab` : `#ffffff`)}
		style:color={config.render.textColor ?? (config.render.hint?.variant === 'primary' ? `#ffffff` : `#5d21ab`)}
		data-widget="submit"
		data-type="button"
		data-form-id={formId}
		data-widget-id={config.id}
		onclick={(e) => {
			e.preventDefault();
			void onSubmit(e);
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				void onSubmit(e);
			}
		}}
	>
		{config.label}
	</button>
{:else}
	<!-- svelte-ignore a11y_missing_attribute -->
	<a
		data-widget="submit"
		data-type="link"
		data-form-id={formId}
		data-widget-id={config.id}
		tabindex="0"
		role="button"
		onclick={(e) => {
			e.preventDefault();
			void onSubmit(e);
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				void onSubmit(e);
			}
		}}
	>
		{config.label}
	</a>
{/if}
