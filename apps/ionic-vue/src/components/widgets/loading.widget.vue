<script lang="ts" setup>
withDefaults(defineProps<{ diameter?: number; stroke?: number }>(), {
	diameter: 80,
	stroke: 2.5,
});
</script>

<template>
	<div data-loader>
		<svg :style="{ width: `${diameter}px`, height: `${diameter}px` }" viewBox="25 25 50 50" class="spinner" role="presentation" aria-hidden="true">
			<circle :style="{ strokeWidth: `${stroke}px` }" cx="50" cy="50" r="20" class="circle"></circle>
		</svg>
	</div>
</template>

<style lang="scss" scoped>
@keyframes loading-rotate {
	100% {
		transform: rotate(360deg);
	}
}

@keyframes loading-dash {
	0% {
		stroke-dasharray: 1, 200;
		stroke-dashoffset: 0;
	}

	50% {
		stroke-dasharray: 90, 150;
		stroke-dashoffset: -40px;
	}

	100% {
		stroke-dasharray: 90, 150;
		stroke-dashoffset: -120px;
	}
}

[data-loader] {
	position: relative;
	box-sizing: border-box;
	display: flex;
	align-items: center;
	justify-content: center;

	.spinner {
		fill: none;
		animation: var(--sty-loader-spinner-animation, loading-rotate 2000ms linear infinite);
		animation-direction: normal;
	}

	.circle {
		stroke: currentColor;
		stroke-dasharray: 90, 150;
		stroke-dashoffset: 0;
		stroke-linecap: round;
		animation: var(--sty-loader-circle-animation, loading-dash 1500ms ease-in-out infinite);
		animation-direction: normal;
	}
}
</style>
