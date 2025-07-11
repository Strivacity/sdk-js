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

### 4. File-Based Routing

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

### 5. Environment Variables

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
