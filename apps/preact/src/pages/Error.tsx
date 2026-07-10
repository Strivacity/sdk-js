export default function Error() {
	const searchParams = new URLSearchParams(window.location.search);
	const message = searchParams.get('error_description') || searchParams.get('error');

	return (
		<section>
			<h2>Something went wrong</h2>
			{message && <p class="profile-muted">{decodeURIComponent(message)}</p>}
		</section>
	);
}
