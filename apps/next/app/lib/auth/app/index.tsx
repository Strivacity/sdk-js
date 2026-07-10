import { sdkOptions } from '../options';
import { AppServer } from './server';
import { AppClient } from './client';

export function App({ children }: { children: React.ReactNode }) {
	// NOTE: This demo shows both session modes side by side.
	// in your own app, keep only the branch matching your `serverSideSession` setting.
	return sdkOptions.serverSideSession ? <AppServer>{children}</AppServer> : <AppClient>{children}</AppClient>;
}
