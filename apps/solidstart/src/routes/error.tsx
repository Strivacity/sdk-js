import { useSearchParams } from '@solidjs/router';

export default function ErrorPage() {
	const [searchParams] = useSearchParams();
	const message = () =>
		(searchParams.error_description as string | undefined) ?? (searchParams.error as string | undefined) ?? (searchParams.message as string | undefined);

	return (
		<section>
			<h2>Something went wrong</h2>
			{message() && <p class="profile-muted">{decodeURIComponent(message()!)}</p>}
		</section>
	);
}
