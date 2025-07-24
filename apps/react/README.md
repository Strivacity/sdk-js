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

### 3. Route Protection

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

### 4. React Router Integration

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
