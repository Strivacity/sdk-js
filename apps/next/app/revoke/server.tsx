import { redirect } from 'next/navigation';

export default function RevokeServer() {
	redirect('/auth/revoke');
	return null;
}
