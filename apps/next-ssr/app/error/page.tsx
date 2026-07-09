type Props = {
	searchParams: Promise<{ message?: string }>;
};

export default async function ErrorPage({ searchParams }: Props) {
	const { message } = await searchParams;

	return (
		<section className="profile">
			<h2>Something went wrong</h2>
			{message && <p className="profile-muted">{decodeURIComponent(message)}</p>}
		</section>
	);
}
