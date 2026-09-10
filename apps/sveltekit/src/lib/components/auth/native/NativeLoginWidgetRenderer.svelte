<script lang="ts">
	import type { LayoutWidget, Widget } from '@strivacity/sdk-svelte/client';
	import { useNativeLoginContext } from '@strivacity/sdk-svelte/client';
	import { widgets } from './widgets';
	import NativeLoginWidgetRenderer from './NativeLoginWidgetRenderer.svelte';

	let { items = [] }: { items?: LayoutWidget['items'] } = $props();

	// useNativeLoginContext() reads the state/actions provided by the useNativeLogin() call
	// that mounted this tree (see NativeLogin.svelte), without needing them passed down as props
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
			<!-- triggerFallback() bails out to the hosted (non-native) journey when something unexpected happens -->
			{context.triggerFallback(`Unable to find form or widget for item: formId=${item.formId}, widgetId=${item.widgetId}`) ?? ''}
		{/if}
	{:else if item.type === 'vertical' || item.type === 'horizontal'}
		{@const LayoutComponent = widgets.layout}
		<LayoutComponent formId={(item.items[0] as Widget).formId} type={item.type}>
			<NativeLoginWidgetRenderer items={item.items} />
		</LayoutComponent>
	{:else}
		{context.triggerFallback('Unknown item type in layout') ?? ''}
	{/if}
{/each}

