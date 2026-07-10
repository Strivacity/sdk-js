<script lang="ts">
	import { page } from '$app/state';
</script>

<section>
	<h1>Error in authentication</h1>
	<div>
		<p>{page.url.searchParams.get('message') ?? page.url.searchParams.get('error_description') ?? 'Unknown error'}</p>
	</div>
</section>
