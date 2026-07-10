import { pageRoutes } from 'virtual:file-routes';
import { createRouter } from '@solidjs/router';
import { fileRoutes } from '@solidjs/router/fs';
import { createMemo, Loading } from 'solid-js';
import { StyAuthProvider, createDefaultLogging } from '@strivacity/sdk-solid/client';
import Header from './components/Header';
import { sdkOptions } from './options';
import { getSession } from './server/session';
import '@strivacity/common/styles/globals.css';

const Router = createRouter({ routes: fileRoutes(pageRoutes) });

export default function App() {
	const session = createMemo(() => getSession());

	return (
		<Loading fallback={<main>Loading…</main>}>
			<StyAuthProvider options={{ ...sdkOptions, logging: createDefaultLogging() }} session={session()}>
				<div id="app">
					<Router>
						{(routerProps) => (
							<>
								<Header />
								<Loading fallback={<main>Loading…</main>}>{routerProps.children}</Loading>
							</>
						)}
					</Router>
				</div>
			</StyAuthProvider>
		</Loading>
	);
}
