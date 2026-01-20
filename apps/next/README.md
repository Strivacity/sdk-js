# Strivacity SDK - Next.js Example App

This example application demonstrates how to integrate the Strivacity SDK into a Next.js application using the App Router and React Server Components, while maintaining client-side authentication state management.

## Key Features and Implementation

### 1. Next.js Dependencies

This Next.js application uses the Strivacity Next.js SDK for authentication (see [package.json](./package.json)):

```json
{
	"@strivacity/sdk-next": "*"
}
```

### 2. App Router Integration

The application uses Next.js App Router with client-side authentication provider in the root layout (see [src/app/layout.tsx](./src/app/layout.tsx)):

```tsx
'use client';

import { type SDKOptions, StyAuthProvider } from '@strivacity/sdk-next';

const options: SDKOptions = {
	mode: process.env.MODE as 'redirect' | 'popup' | 'native',
	issuer: process.env.ISSUER as string,
	clientId: process.env.CLIENT_ID as string,
	scopes: process.env.SCOPES?.split(' ') as Array<string>,
	redirectUri: process.env.REDIRECT_URI as string,
	storageTokenName: 'sty.session.next',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body>
				<StyAuthProvider options={options}>{children}</StyAuthProvider>
			</body>
		</html>
	);
}
```

### 3. Client-Side Authentication State

The application manages authentication state on the client side while leveraging Next.js features (see [src/app/layout.tsx](./src/app/layout.tsx)):

```tsx
'use client';

import { useStrivacity } from '@strivacity/sdk-next';

function App({ children }: { children: React.ReactElement }) {
	const { loading, isAuthenticated, idTokenClaims } = useStrivacity();
	const [name, setName] = useState<string | null>(null);

	useEffect(() => {
		if (isAuthenticated) {
			setName(`${idTokenClaims?.given_name ?? ''} ${idTokenClaims?.family_name ?? ''}`);
		}
	}, [isAuthenticated, idTokenClaims]);

	return (
		<div>
			{loading && <div>Loading...</div>}
			{isAuthenticated && <div>Welcome, {name}!</div>}
			{children}
		</div>
	);
}
```

### 4. Logging

You can enable SDK logging or plug in your own logger.

- Enable default logging by adding `logging: DefaultLogging` to the SDK options in [src/app/layout.tsx](./src/app/layout.tsx). The default logger writes to the browser console and automatically prefixes messages with an `xEventId` property when available

```tsx
'use client';

import { type SDKOptions, StyAuthProvider, DefaultLogging } from '@strivacity/sdk-next';

const options: SDKOptions = {
	// ...other options
	logging: DefaultLogging, // enable built-in console logging
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body>
				<StyAuthProvider options={options}>{children}</StyAuthProvider>
			</body>
		</html>
	);
}
```

- Provide a custom logger by implementing the `SDKLogging` interface (methods: `debug`, `info`, `warn`, `error`). An optional `xEventId` property is honored for log correlation. See the built-in implementation for reference in [packages/sdk-core/src/utils/Logging.ts](../../packages/sdk-core/src/utils/Logging.ts).

```ts
import type { SDKLogging } from '@strivacity/sdk-next';

export class MyLogger implements SDKLogging {
	xEventId?: string;

	debug(message: string): void {
		// e.g., send to your logging pipeline
		console.log(this.xEventId ? `(${this.xEventId}) ${message}` : message);
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

Then register your logger class in the SDK options:

```tsx
import { StyAuthProvider } from '@strivacity/sdk-next';
import { MyLogger } from './logging/MyLogger';

const options: SDKOptions = {
	// ...other options
	logging: MyLogger,
};
```

### 5. File-Based Routing

The application uses Next.js file-based routing with pages for different authentication flows:

```
src/app/
├── layout.tsx          # Root layout with auth provider
├── page.tsx           # Home page
├── login/page.tsx     # Login page
├── register/page.tsx  # Registration page
├── callback/page.tsx  # OAuth callback handler
├── profile/page.tsx   # Protected profile page
└── logout/page.tsx    # Logout page
```

### 6. Environment Variables

Next.js environment variables are configured for different deployment environments (see [next.config.js](./next.config.js)):

```javascript
const nextConfig = {
	env: {
		MODE: process.env.VITE_MODE,
		ISSUER: process.env.VITE_ISSUER,
		CLIENT_ID: process.env.VITE_CLIENT_ID,
		SCOPES: process.env.VITE_SCOPES,
		REDIRECT_URI: process.env.VITE_REDIRECT_URI,
	},
};
```

## Installation and Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Variables Setup

Create a `.env.local` file in the repository root:

```env
VITE_ISSUER=your-cluster-domain
VITE_CLIENT_ID=your-client-id
VITE_SCOPES=openid profile email
VITE_REDIRECT_URI=http://localhost:3000/callback
VITE_MODE=redirect
```

### 3. Running the Application

#### Development Server

```bash
pnpm app:next:serve
```

#### Production Build

```bash
pnpm run build
pnpm start
```

## Architecture Overview

### SDK Integration

The Strivacity SDK is integrated at the root layout level, providing authentication context throughout the Next.js application while maintaining compatibility with App Router (see [src/app/layout.tsx](./src/app/layout.tsx)).

### Page Components

Next.js pages can access authentication state through the `useStrivacity` hook:

```tsx
'use client';

import { useStrivacity } from '@strivacity/sdk-next';

export default function ProfilePage() {
	const { loading, isAuthenticated, idTokenClaims } = useStrivacity();

	if (!isAuthenticated) {
		redirect('/login');
	}

	return (
		<div>
			<h1>Profile</h1>
			<p>Email: {idTokenClaims?.email}</p>
		</div>
	);
}
```

## Pages

Brief, purpose-oriented descriptions of files under src/app — what they do, expected behavior, and how they use the Strivacity hook/provider.

- src/app/page.tsx
  - Purpose: Landing / home page. Publicly accessible; introduces the app and links to login/register.
  - Behavior: Shows public content and optionally user info when authenticated via useStrivacity(). Should render quickly and not block navigation.
  - Usage: const { loading, isAuthenticated, idTokenClaims } = useStrivacity(); Use client-side rendering for user-specific bits.

- src/app/login/page.tsx
  - Purpose: Login page / entry point for authentication flows.
  - Behavior: Triggers the SDK login flow (redirect/popup/native depending on options). If the user is already authenticated, redirect to /profile or another intended route.
  - Usage: Check isAuthenticated and call login() from useStrivacity(); provide UX for popup vs redirect modes.

- src/app/register/page.tsx
  - Purpose: Registration page (if supported).
  - Behavior: Starts a registration flow or presents a registration form that calls backend/SDK to create a user. On success, either sign in automatically or redirect to login.
  - Usage: Use SDK registration helper if provided (e.g., useStrivacity().register()) or post to your backend.

- src/app/entry/page.tsx
  - Purpose: Entry page used by link-driven flows to start server/SDK-driven operations.
  - Behavior: Calls the provider/hook entry() method; if a session_id is returned, redirect to /callback?session_id=...; otherwise fallback to home. Show loading and error states.
  - Usage: const { entry } = useStrivacity(); handle network errors and timeouts gracefully.

- src/app/callback/page.tsx
  - Purpose: OAuth / OpenID Connect callback handler — identity provider returns here.
  - Behavior: Receives query params (code, state, session_id), finalizes authentication via SDK (handleRedirect/token exchange) in a client effect, then redirects to the intended route (e.g., /profile).
  - Note: Keep this route unprotected so external providers can return to it.
  - Usage: Parse URL params, call SDK's callback/handleRedirect, handle success/error and redirect.

- src/app/profile/page.tsx
  - Purpose: Protected user profile page.
  - Behavior: Require authentication (client-side guard or server redirect). Displays idTokenClaims and other user data from useStrivacity and offers logout.
  - Usage: const { idTokenClaims, logout } = useStrivacity(); optionally fetch server-backed profile data using the authenticated session.

- src/app/revoke/page.tsx
  - Purpose: Revoke tokens or sessions (optional advanced session management page).
  - Behavior: Calls SDK or backend revoke API to invalidate refresh tokens/sessions, surfaces success/error, then redirects or logs out.
  - Usage: Call revoke endpoints via SDK or your backend; after success call logout() and redirect to home.

- src/app/logout/page.tsx
  - Purpose: Initiates logout and clears the session.
  - Behavior: Calls the SDK logout method, clears client session state, and redirects to home or login. Implement as a simple action page that shows progress and redirects on completion.
  - Usage: Perform logout in an effect and route the user to a public page when complete.
