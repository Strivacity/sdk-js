import { redirect } from 'next/navigation';

export default function LogoutServer() {
	redirect('/auth/logout');
}
