# Strivacity SDK - React Example App

This example application demonstrates how to integrate the Strivacity SDK into a React application using React Router for navigation and modern React patterns including hooks and context.

## Key Features and Implementation

### 1. React Dependencies

This React application uses the Strivacity React SDK for authentication (see [package.json](./package.json)):

```json
{
	"@strivacity/sdk-react": "*"
}
```

### 2. Provider Pattern Integration

The application uses React's context pattern through the `StyAuthProvider` to provide authentication state throughout the component tree (see [src/main.tsx](./src/main.tsx)):

```tsx
import { StyAuthProvider, type SDKOptions } from '@strivacity/sdk-react';

const options: SDKOptions = {
	mode: import.meta.env.VITE_MODE,
	issuer: import.meta.env.VITE_ISSUER,
	scopes: import.meta.env.VITE_SCOPES.split(' '),
	clientId: import.meta.env.VITE_CLIENT_ID,
	redirectUri: import.meta.env.VITE_REDIRECT_URI,
	storageTokenName: 'sty.session.react',
};

<StyAuthProvider options={options}>
	<BrowserRouter>
		<Routes>// Routes configuration</Routes>
	</BrowserRouter>
</StyAuthProvider>;
```

### 3. Logging

You can enable SDK logging or plug in your own logger.

- Enable default logging by adding `logging: DefaultLogging` to the SDK options in [src/main.tsx](./src/main.tsx). The default logger writes to the browser console and automatically prefixes messages with an `xEventId` property when available

```tsx
import { StyAuthProvider, type SDKOptions, DefaultLogging } from '@strivacity/sdk-react';

const options: SDKOptions = {
	// ...other options
	logging: DefaultLogging, // enable built-in console logging
};

<StyAuthProvider options={options}>{/* Your app */}</StyAuthProvider>;
```

- Provide a custom logger by implementing the `SDKLogging` interface (methods: `debug`, `info`, `warn`, `error`). An optional `xEventId` property is honored for log correlation. See the built-in implementation for reference in [packages/sdk-core/src/utils/Logging.ts](../../packages/sdk-core/src/utils/Logging.ts).

```ts
import type { SDKLogging } from '@strivacity/sdk-react';

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
import { StyAuthProvider } from '@strivacity/sdk-react';
import { MyLogger } from './logging/MyLogger';

const options: SDKOptions = {
	// ...other options
	logging: MyLogger,
};
```

### 4. Route Protection

The application implements route guards using React hooks to protect authenticated routes (see [src/main.tsx](./src/main.tsx)):

```tsx
import { useStrivacity } from '@strivacity/sdk-react';

const RouteGuard = ({ children }: { children: React.ReactElement }) => {
	const { loading, isAuthenticated } = useStrivacity();

	if (loading) {
		return <h1>Loading...</h1>;
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" replace />;
	}

	return children;
};
```

### 5. React Router Integration

The application uses React Router for client-side navigation with protected and public routes:

```tsx
<Routes>
	<Route path="/" element={<App />}>
		<Route index element={<Home />} />
		<Route path="login" element={<Login />} />
		<Route path="register" element={<Register />} />
		<Route path="callback" element={<Callback />} />
		<Route
			path="profile"
			element={
				<RouteGuard>
					<Profile />
				</RouteGuard>
			}
		/>
		<Route
			path="logout"
			element={
				<RouteGuard>
					<Logout />
				</RouteGuard>
			}
		/>
		<Route
			path="revoke"
			element={
				<RouteGuard>
					<Revoke />
				</RouteGuard>
			}
		/>
	</Route>
</Routes>
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

```bash
pnpm app:react:serve
```

## Architecture Overview

### SDK Integration

The Strivacity SDK is integrated using React's provider pattern, making authentication state available throughout the component tree (see [src/main.tsx](./src/main.tsx)).

### Component Usage

React components can access authentication state and methods through the `useStrivacity` hook (see [src/components/App.tsx](./src/components/App.tsx)):

```tsx
import { useStrivacity } from '@strivacity/sdk-react';

export function App() {
	const { loading, isAuthenticated, idTokenClaims } = useStrivacity();

	return (
		<div>
			{loading && <div>Loading...</div>}
			{isAuthenticated && <div>Welcome, {idTokenClaims?.name}!</div>}
		</div>
	);
}
```

### Pages

Brief, purpose-oriented descriptions of files under src/pages — what they do, expected behavior, and how they use the Strivacity hook.

- src/pages/Home.tsx
  - Purpose: Landing / home page. Publicly accessible; introduces the app and links to login/register.
  - Behavior: Shows public content and, when authenticated, brief user info from useStrivacity(). Should be fast and accessible without auth.
  - Usage: const { loading, isAuthenticated, idTokenClaims } = useStrivacity(); render conditional UI accordingly.

- src/pages/Login.tsx
  - Purpose: Login page / entry point for authentication flows.
  - Behavior: Triggers the SDK login flow (redirect/popup/native based on options). If already authenticated, typically redirect to /profile.
  - Usage: Call useStrivacity().login(); guard the route by checking isAuthenticated and redirect when appropriate.

- src/pages/Register.tsx
  - Purpose: Registration page (if supported).
  - Behavior: Starts a registration flow or shows a form and calls backend/SDK to create a user. On success either sign-in or navigate to login.
  - Usage: Use the SDK registration API or a custom backend action then call login or navigate.

- src/pages/Entry.tsx
  - Purpose: Entry page used by link-driven flows to start server/SDK-driven operations.
  - Behavior: Calls the hook's entry() method; if a session_id is returned, redirect to /callback?session_id=... otherwise fallback to home. Show loading/error states.
  - Usage: const { entry } = useStrivacity(); handle returned session IDs and errors with clear UX.

- src/pages/Callback.tsx
  - Purpose: OAuth / OpenID Connect callback handler — identity provider returns here.
  - Behavior: Receives query params (code, state, session_id), finalizes authentication via SDK, then redirects to the intended route (e.g., /profile).
  - Note: Keep this route unprotected so external providers can return to it.
  - Usage: Parse params and call SDK handleRedirect/handleCallback in an effect and redirect on success.

- src/pages/Profile.tsx
  - Purpose: Protected user profile page.
  - Behavior: Require authentication (route guard or component-level check). Displays idTokenClaims and other user data from useStrivacity; optionally fetch server data using the session.
  - Usage: const { idTokenClaims, logout } = useStrivacity(); provide logout button and profile editing or server-backed data as needed.

- src/pages/Revoke.tsx
  - Purpose: Revoke tokens or sessions (optional advanced session management page).
  - Behavior: Calls SDK or backend revoke API to invalidate refresh tokens/sessions, surfaces success/error, then redirects or logs out.
  - Usage: Call revoke() and then logout/redirect on success; present clear confirmation and error handling.

- src/pages/Logout.tsx
  - Purpose: Initiates logout and clears the session.
  - Behavior: Calls the SDK logout method, clears client session state, and redirects to home or login. Implement as an effect that shows progress and navigates away.
  - Usage: Perform logout in a useEffect and navigate when complete.
