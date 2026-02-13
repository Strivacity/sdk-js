# Strivacity SDK - Remix Example App

This example application demonstrates how to integrate the Strivacity SDK into a Remix application using client-side authentication while maintaining compatibility with Remix's server-side rendering capabilities.

## Key Features and Implementation

### 1. Remix Dependencies

This Remix application uses the Strivacity Remix SDK for authentication (see [package.json](./package.json)):

```json
{
	"@strivacity/sdk-remix": "*"
}
```

### 2. Client-Side Authentication Provider

The application uses the `StyAuthProvider` with client-only rendering for authentication state management (see [src/root.tsx](./src/root.tsx)):

```tsx
import { ClientOnly } from 'remix-utils/client-only';
import { type SDKOptions, StyAuthProvider } from '@strivacity/sdk-remix';

const options: SDKOptions = {
	mode: import.meta.env.VITE_MODE,
	issuer: import.meta.env.VITE_ISSUER,
	scopes: import.meta.env.VITE_SCOPES.split(' '),
	clientId: import.meta.env.VITE_CLIENT_ID,
	redirectUri: import.meta.env.VITE_REDIRECT_URI,
	storageTokenName: 'sty.session.remix',
};

export default function App() {
	return (
		<html lang="en">
			<body>
				<ClientOnly fallback={<div>Loading...</div>}>
					{() => (
						<StyAuthProvider options={options}>
							<AppContent />
						</StyAuthProvider>
					)}
				</ClientOnly>
			</body>
		</html>
	);
}
```

### 3. Logging

You can enable SDK logging or plug in your own logger.

- Enable default logging by adding `logging: DefaultLogging` to the SDK options in [src/root.tsx](./src/root.tsx). The default logger writes to the browser console and automatically prefixes messages with an `xEventId` property when available

```tsx
import { ClientOnly } from 'remix-utils/client-only';
import { type SDKOptions, StyAuthProvider, DefaultLogging } from '@strivacity/sdk-remix';

const options: SDKOptions = {
	// ...other options
	logging: DefaultLogging, // enable built-in console logging
};

export default function App() {
	return (
		<html lang="en">
			<body>
				<ClientOnly fallback={<div>Loading...</div>}>
					{() => (
						<StyAuthProvider options={options}>
							<AppContent />
						</StyAuthProvider>
					)}
				</ClientOnly>
			</body>
		</html>
	);
}
```

- Provide a custom logger by implementing the `SDKLogging` interface (methods: `debug`, `info`, `warn`, `error`). An optional `xEventId` property is honored for log correlation. See the built-in implementation for reference in [packages/sdk-core/src/utils/Logging.ts](../../packages/sdk-core/src/utils/Logging.ts).

```ts
import type { SDKLogging } from '@strivacity/sdk-remix';

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
import { StyAuthProvider } from '@strivacity/sdk-remix';
import { MyLogger } from './logging/MyLogger';

const options: SDKOptions = {
	// ...other options
	logging: MyLogger,
};
```

### 4. Remix Route Integration

The application uses Remix's file-based routing with authentication-aware components (see [src/root.tsx](./src/root.tsx)):

```tsx
import { useStrivacity } from '@strivacity/sdk-remix';
import { Link } from '@remix-run/react';

export function AppHeader() {
	const { loading, isAuthenticated, idTokenClaims } = useStrivacity();
	const [name, setName] = useState('');

	useEffect(() => {
		setName(`${idTokenClaims?.given_name ?? ''} ${idTokenClaims?.family_name ?? ''}`);
	}, [isAuthenticated, idTokenClaims]);

	return (
		<header>
			<div>{isAuthenticated ? <strong>Welcome, {name}!</strong> : loading ? <strong>Loading...</strong> : null}</div>
			<nav>
				<Link to="/">Home</Link>
				{isAuthenticated ? (
					<>
						<Link to="/profile">Profile</Link>
						<Link to="/logout">Logout</Link>
					</>
				) : (
					<>
						<Link to="/login">Login</Link>
						<Link to="/register">Register</Link>
					</>
				)}
			</nav>
		</header>
	);
}
```

### 5. File-Based Routing Structure

The application uses Remix's file-based routing for different authentication flows:

```
src/routes/
├── _index.tsx          # Home page
├── login.tsx           # Login page
├── register.tsx        # Registration page
├── callback.tsx        # OAuth callback handler
├── profile.tsx         # Protected profile page
└── logout.tsx          # Logout page
```

### 6. Client-Only Authentication

Authentication state is managed client-side while maintaining SSR compatibility:

```tsx
import { ClientOnly } from 'remix-utils/client-only';

export default function ProtectedRoute() {
	return <ClientOnly fallback={<div>Loading...</div>}>{() => <AuthenticatedContent />}</ClientOnly>;
}

function AuthenticatedContent() {
	const { isAuthenticated, idTokenClaims } = useStrivacity();

	if (!isAuthenticated) {
		return <Navigate to="/login" />;
	}

	return (
		<div>
			<h1>Profile</h1>
			<p>Email: {idTokenClaims?.email}</p>
		</div>
	);
}
```

### 7. Remix Meta and Links

The application integrates with Remix's meta and link functions for SEO and asset management:

```tsx
import type { MetaFunction } from '@remix-run/node';

export const meta: MetaFunction = () => {
	return [{ title: 'Strivacity Remix App' }, { name: 'description', content: 'Remix app with Strivacity authentication' }];
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
pnpm app:remix:serve
```

#### Production Build

```bash
pnpm run build
pnpm start
```

## Architecture Overview

### SDK Integration

The Strivacity SDK is integrated using client-only rendering to maintain compatibility with Remix's SSR while providing authentication functionality (see [src/root.tsx](./src/root.tsx)).

### Route Components

Remix route components can access authentication state through the `useStrivacity` hook:

```tsx
// src/routes/profile.tsx
import { useStrivacity } from '@strivacity/sdk-remix';
import { Navigate } from '@remix-run/react';

export default function Profile() {
	const { loading, isAuthenticated, idTokenClaims } = useStrivacity();

	if (loading) return <div>Loading...</div>;

	if (!isAuthenticated) {
		return <Navigate to="/login" replace />;
	}

	return (
		<div>
			<h1>User Profile</h1>
			<p>Name: {idTokenClaims?.name}</p>
			<p>Email: {idTokenClaims?.email}</p>
		</div>
	);
}
```

## Pages

Brief, purpose-oriented descriptions of files under app/routes — what they do, expected behavior, and how they use the Strivacity hook/provider.

- app/routes/index.tsx
  - Purpose: Landing / home page. Publicly accessible; introduces the app and links to login/register.
  - Behavior: Shows public content and optionally user info using useStrivacity within ClientOnly. Should not block server render paths.
  - Usage: const { loading, isAuthenticated, idTokenClaims } = useStrivacity(); render user info client-side.

- app/routes/login.tsx
  - Purpose: Login page / entry point for authentication flows.
  - Behavior: Initiates the SDK login (redirect/popup) client-side; if already authenticated, redirect to /profile.
  - Usage: Check isAuthenticated in a client effect and call login() from useStrivacity().

- app/routes/register.tsx
  - Purpose: Registration page.
  - Behavior: Starts a registration flow or renders a form that posts to the backend or calls SDK registration helpers.
  - Usage: Call useStrivacity().register() or use an action to create the user then sign them in.

- app/routes/entry.tsx
  - Purpose: Entry route used by link-driven flows to start server/SDK-driven operations.
  - Behavior: Calls entry() from the SDK (client or action). It returns an object `{ session_id: string; short_app_id?: string }`. Forward these as query params using `new URLSearchParams(data)` to `/callback`; otherwise fallback to home. Show loading/error states.
  - Usage: Use ClientOnly or an action to call entry() and redirect based on the returned params.

- app/routes/callback.tsx
  - Purpose: OAuth / OpenID Connect callback handler — identity provider returns here.
  - Behavior: Receives query params (code, state, session_id) and finalizes authentication (token exchange or session resume) in a client effect or action, then redirects to the intended route.
  - Note: Keep this route unprotected so external providers can return.
  - Usage: Parse params and call SDK handleRedirect/handleCallback; on success navigate to profile or saved redirect.

- app/routes/profile.tsx
  - Purpose: Protected user profile page.
  - Behavior: Require authentication (loader redirect or client-side guard within ClientOnly). Displays idTokenClaims and other user data from useStrivacity.
  - Usage: const { idTokenClaims, logout } = useStrivacity(); provide logout and optional server-backed profile fetches.

- app/routes/revoke.tsx
  - Purpose: Revoke tokens or sessions (optional advanced session management route).
  - Behavior: Calls SDK or backend revoke API to invalidate refresh tokens/sessions, surfaces success/error, then logs out or redirects.
  - Usage: Use an action or client call to revoke; after success call logout() and redirect.

- app/routes/logout.tsx
  - Purpose: Initiates logout and clears the session.
  - Behavior: Calls the SDK logout (client or action), clears session state and redirects to home/login.
  - Usage: Implement as loader/action or client effect that performs logout and returns a redirect response.
