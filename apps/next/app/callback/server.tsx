import { redirect } from 'next/navigation';

export default function CallbackServer({ params }: { params: URLSearchParams }) {
	redirect(`/auth/callback?${params.toString()}`);
}
