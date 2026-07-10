export default async function ErrorPage({ searchParams }) {
	const params = Object.fromEntries(new URLSearchParams(await searchParams));
	const message = params.error_description || params.error;

	return (
		<section>
			<h2>Something went wrong</h2>
			{message && <p className="profile-muted">{decodeURIComponent(message)}</p>}
		</section>
	);
}
