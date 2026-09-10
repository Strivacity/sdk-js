import { App } from './lib/auth/app';
import { AuthProvider } from './lib/auth/provider';
import { sdk } from './lib/auth/server';
import '@strivacity/common/styles/globals.css';

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	const session = await sdk.getSession();

	return (
		<html lang="en-US">
			<body>
				<AuthProvider session={session}>
					<App>{children}</App>
				</AuthProvider>
			</body>
		</html>
	);
}
