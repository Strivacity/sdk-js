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

### 3. Remix Route Integration

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

### 4. File-Based Routing Structure

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

### 5. Client-Only Authentication

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

### 6. Remix Meta and Links

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
