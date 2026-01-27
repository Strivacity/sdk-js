<script lang="ts">
	import type { NativeFlowContextValue, LayoutWidget } from '@strivacity/sdk-svelte';
	import type { Snippet } from 'svelte';
	import { getContext } from 'svelte';

	let { formId, type, tag = 'div', children }: { formId: string; type: LayoutWidget['type']; tag?: string; children: Snippet } = $props();

	const context = getContext<NativeFlowContextValue>('nativeFlowContext');
	const disabled = $derived(context.loading);

	async function onSubmit() {
		if (disabled) {
			return;
		}

		await context.submitForm(formId);
	}
</script>

<svelte:element
	this={tag}
	data-widget="layout"
	data-type={type}
	data-form-id={formId}
	onsubmit={(e) => {
		e.preventDefault();
		void onSubmit();
	}}
>
	{@render children()}
</svelte:element>

<style lang="scss">
	:global {
		[data-widget='layout'] {
			display: flex;
			flex-direction: column;
			width: 100%;
			margin-block-end: 1rem;

			&[data-type='horizontal'] {
				flex-direction: row;
				align-items: center;
				justify-content: center;

				* + * {
					margin-inline-start: 0.25rem;
				}
			}

			&[data-type='vertical'] {
				flex-direction: column;
				justify-content: center;
			}
		}
	}
</style>
