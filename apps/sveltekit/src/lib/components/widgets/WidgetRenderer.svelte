<script lang="ts">
	import type { LayoutWidget, Widget } from '@strivacity/sdk-svelte/client';
	import { useNativeLoginContext } from '@strivacity/sdk-svelte/client';
	import { widgets } from './index';
	import WidgetRenderer from './WidgetRenderer.svelte';

	let { items = [] }: { items?: LayoutWidget['items'] } = $props();

	const context = useNativeLoginContext();
</script>

{#each items as item, index (index)}
	{#if item.type === 'widget'}
		{@const form = context.state.forms?.find((form) => form.id === item.formId)}
		{@const widget = form?.widgets.find((widget) => widget.id === item.widgetId)}
		{#if form && widget}
			{@const WidgetComponent = widgets[widget.type]}
			<WidgetComponent formId={form.id} config={widget} />
		{:else}
			{context.triggerFallback(`Unable to find form or widget for item: formId=${item.formId}, widgetId=${item.widgetId}`) ?? ''}
		{/if}
	{:else if item.type === 'vertical' || item.type === 'horizontal'}
		{@const LayoutComponent = widgets.layout}
		<LayoutComponent formId={(item.items[0] as Widget).formId} type={item.type}>
			<WidgetRenderer items={item.items} />
		</LayoutComponent>
	{:else}
		{context.triggerFallback('Unknown item type in layout') ?? ''}
	{/if}
{/each}

