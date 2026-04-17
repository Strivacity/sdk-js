# Strivacity SDK - Next.js Headless Example App

This example application demonstrates how to integrate the [@strivacity/sdk-next](https://github.com/Strivacity/sdk-js/tree/main/packages/sdk-next) SDK into a Next.js application using the App Router with a fully custom, headless login UI. Unlike the standard Next.js app, this example implements the Native Journey directly — rendering each authentication screen by hand without using `StyLoginRenderer` or any web components.

See our [Developer Portal](https://www.strivacity.com/learn-support/developer-hub) to get started with developing with the Strivacity product.

## Overview

The SDK is initialized via `StyAuthProvider` in `src/app/layout.tsx`. Login state is managed manually using `NativeFlowHandler` — on each step the handler returns a `LoginFlowState` describing the current screen and available forms, which the login page renders as plain HTML form elements.

## Requirements

- Next.js: 15+
- Node.js: 20 LTS+

## Install

```bash
pnpm install
```

Create a `.env.local` file in the repository root:

```env
VITE_MODE=native
VITE_ISSUER=your-cluster-domain
VITE_CLIENT_ID=your-client-id
VITE_SCOPES=openid profile email
VITE_REDIRECT_URI=http://localhost:4200/callback
```

Then start the development server:

```bash
pnpm app:next-headless:serve
```

## Usage

### Initialization

The SDK is configured with `mode: 'native'` in `src/app/layout.tsx` using `StyAuthProvider`:

```tsx
'use client';

import { type SDKOptions, StyAuthProvider, DefaultLogging } from '@strivacity/sdk-next';

const options: SDKOptions = {
	mode: 'native',
	issuer: process.env.ISSUER as string,
	clientId: process.env.CLIENT_ID as string,
	scopes: process.env.SCOPES?.split(' ') as Array<string>,
	redirectUri: process.env.REDIRECT_URI as string,
	storageTokenName: 'sty.session.next',
	logging: DefaultLogging,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return <StyAuthProvider options={options}>{children}</StyAuthProvider>;
}
```

### Headless login flow

`src/app/login/page.tsx` implements the full login UI without using `StyLoginRenderer`. It manages flow state manually using `NativeFlowHandler`:

1. `sdk.login(extraParams)` is called to get a `NativeFlowHandler`.
2. `handler.startSession(sessionId?)` initiates the session and returns the first `LoginFlowState`.
3. The component renders the appropriate form based on `state.screen` (e.g. `'identification'`, `'password'`, `'registration'`).
4. On form submission, `handler.submitForm(formId, data)` advances the flow and returns the next state.
5. When `sdk.isAuthenticated` becomes `true`, the user is redirected to `/profile`.
6. If `FallbackError` is thrown and `state.hostedUrl` is set, the page redirects to the hosted login URL.

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity } from '@strivacity/sdk-next';
import { FallbackError } from '@strivacity/sdk-core';

export default function LoginPage() {
	const router = useRouter();
	const { sdk } = useStrivacity();
	const [handler, setHandler] = useState(null);
	const [state, setState] = useState({});
	const [isLoading, setIsLoading] = useState(false);
	const [formData, setFormData] = useState({});

	useEffect(() => {
		(async () => {
			setIsLoading(true);
			const loginHandler = sdk.login();
			setHandler(loginHandler);
			const flowState = await loginHandler.startSession();
			if (flowState) setState(flowState);
			setIsLoading(false);
		})();
	}, []);

	const onFormSubmit = async (formId, event) => {
		event.preventDefault();
		setIsLoading(true);
		try {
			const newState = await handler.submitForm(formId, formData);
			if (await sdk.isAuthenticated) {
				router.push('/profile');
			} else {
				setState(newState);
			}
		} catch (error) {
			if (error instanceof FallbackError && state.hostedUrl) {
				window.location.href = state.hostedUrl;
			} else {
				alert(error.message);
				window.location.href = '/';
			}
		} finally {
			setIsLoading(false);
		}
	};

	// Render form based on state.screen ...
}
```

### Refresh token

Token refresh runs automatically when the SDK detects an expired access token.

### Revoke session / logout

`src/app/revoke/page.tsx` revokes the current session tokens without a full logout and returns to the home page.

`src/app/logout/page.tsx` performs a full logout by calling `logout({ postLogoutRedirectUri: location.origin })`.

## Logging

Enable the built-in console logger by passing `logging: DefaultLogging` to the SDK options:

```typescript
import { DefaultLogging } from '@strivacity/sdk-next';

// ...within your SDK options:
logging: DefaultLogging,
```

The default logger writes to the browser console and prefixes messages with the `xEventId` correlation ID when available.

To use a custom logger, implement the `SDKLogging` interface and register your class in the SDK options:

```typescript
import type { SDKLogging } from '@strivacity/sdk-next';

export class MyLogger implements SDKLogging {
	xEventId?: string;

	debug(message: string): void {
		console.debug(this.xEventId ? `(${this.xEventId}) ${message}` : message);
	}
	info(message: string): void {
		console.info(this.xEventId ? `(${this.xEventId}) ${message}` : message);
	}
	warn(message: string): void {
		console.warn(this.xEventId ? `(${this.xEventId}) ${message}` : message);
	}
	error(message: string, error: Error): void {
		console.error(this.xEventId ? `(${this.xEventId}) ${message}` : message, error);
	}
}
```

```typescript
import { MyLogger } from './logging/MyLogger';

// ...within your SDK options:
logging: MyLogger,
```

## Pages

| Page     | Path                        | Description                                                                                                                                           |
| -------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home     | `src/app/page.tsx`          | Public landing page. Displays user info when authenticated.                                                                                           |
| Login    | `src/app/login/page.tsx`    | Fully custom headless login UI. Renders forms by hand based on the `LoginFlowState` screen. Accepts an optional `session_id` URL parameter to resume. |
| Callback | `src/app/callback/page.tsx` | Handles the identity provider's redirect response and completes the authorization flow.                                                               |
| Profile  | `src/app/profile/page.tsx`  | Protected page showing the authenticated user's session details and token information.                                                                |
| Revoke   | `src/app/revoke/page.tsx`   | Invalidates the current session tokens without a full logout and returns the user to the home page.                                                   |
| Logout   | `src/app/logout/page.tsx`   | Terminates the user's session and redirects to the home page after logout.                                                                            |

## Vulnerability Reporting

The [Guidelines for responsible disclosure](https://www.strivacity.com/report-a-security-issue) details the procedure for disclosing security issues. Please do not report security vulnerabilities on the public issue tracker.

## License

This example app is available under the MIT License. See the [LICENSE](https://github.com/Strivacity/sdk-js/blob/main/LICENSE) file for more info.

## Contributing

Please see our [contributing guide](https://github.com/Strivacity/sdk-js/blob/main/CONTRIBUTING.md).
