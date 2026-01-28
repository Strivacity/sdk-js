<script lang="ts">
	import { useStrivacity } from '@strivacity/sdk-svelte';

	const { state } = useStrivacity();
</script>

<section>
	<dl>
		<dt><strong>accessToken</strong></dt>
		<dd>
			<pre>{JSON.stringify(state.accessToken)}</pre>
		</dd>
		<dt><strong>refreshToken</strong></dt>
		<dd>
			<pre>{JSON.stringify(state.refreshToken)}</pre>
		</dd>
		<dt><strong>accessTokenExpired</strong></dt>
		<dd>
			<pre>{JSON.stringify(state.accessTokenExpired)}</pre>
		</dd>
		<dt><strong>accessTokenExpirationDate</strong></dt>
		<dd>
			<pre>{state.accessTokenExpirationDate ? new Date(state.accessTokenExpirationDate * 1000).toLocaleString() : JSON.stringify(null)}</pre>
		</dd>
		<dt><strong>claims</strong></dt>
		<dd>
			<pre>{JSON.stringify(state.idTokenClaims, null, 2)}</pre>
		</dd>
	</dl>
</section>
