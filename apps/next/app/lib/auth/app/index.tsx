import { sdkOptions } from '../options';
import { AppServer } from './server';
import { AppClient } from './client';

export function App({ children }: { children: React.ReactNode }) {
	// This demo shows both session modes side by side.
	// in your own app, keep only the branch matching your `serverSessionUri` setting.
	return sdkOptions.serverSessionUri ? <AppServer>{children}</AppServer> : <AppClient>{children}</AppClient>;
}
