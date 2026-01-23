# Strivacity SDK - Next.js Example App

## How the Login Flow Works (Based on `src/app/login/page.tsx`)

This section explains how the Strivacity SDK is used to implement a custom login flow in Next.js, as seen in [`src/app/login/page.tsx`].

### 1. SDK Initialization

The SDK is accessed via the `useStrivacity` hook, which provides the `sdk` object for authentication operations.

```tsx
const { sdk } = useStrivacity<NativeContext>();
```

### 2. State Variables in the Login Component

The login page uses several React state variables to manage the authentication flow:

```tsx
const [sessionId, setSessionId] = useState<string | null>(null);
// Stores the current session_id if present in the URL. This helps identify the session during the login flow.

const [handler, setHandler] = useState<NativeFlowHandler | null>(null);
// Holds the flow handler instance returned by the Strivacity SDK, which manages the steps of the login process.

const [isLoading, setIsLoading] = useState(true);
// Indicates whether the component is loading or processing an operation.

const [screen, setScreen] = useState<string | null>(null);
// Stores the name of the current login screen (e.g., 'identification', 'password').

const [state, setState] = useState<LoginFlowState>({});
// Contains the current state of the login flow, as returned by the backend.

const [formData, setFormData] = useState<Record<string, unknown>>({});
// Stores the values of the current form fields as entered by the user.

const [messages, setMessages] = useState<Record<string, Record<string, LoginFlowMessage>>>({});
// Holds validation or error messages for forms and fields.
```

### 3. `initializeSession` Function

When the login page loads, the `initializeSession` function is called. It initializes a login session using the SDK's login handler.

```tsx
const loginHandler = sdk.login();
const state = await loginHandler.startSession();
```

### 4. Form Rendering

The login flow is split into multiple screens (e.g., identification, password). The current screen is tracked in state, and the appropriate form is rendered based on the flow state.

```tsx
switch (screen) {
	case 'identification':
	// Render identifier form
	case 'password':
	// Render password form
}
```

**Example: Rendering the identification form**

Below is an example of how the identification form can be implemented. This form collects the user's identifier (such as email or username) and submits it using the login flow handler:

```tsx
<form onSubmit={(e) => onFormSubmit('identifier', e)}>
	<label htmlFor="identifier">Identifier:</label>
	<input id="identifier" type="text" value={formData.identifier || ''} onChange={(e) => handleInputChange('identifier', e.target.value)} required />
	{renderFieldMessage('identifier', 'identifier')}
	<button type="submit" disabled={isLoading}>
		{isLoading ? 'Loading...' : 'Continue'}
	</button>
</form>
```

### 5. Form Submission

The form submission logic is handled by the `onFormSubmit` function. When a form is submitted, the SDK's flow handler is used to submit the form data. If authentication succeeds, the user is redirected to the profile page.

```tsx
// ...inside the Login component...
const onFormSubmit = async (formId: string, event: React.FormEvent) => {
	event.preventDefault();

	if (!handler) {
		return;
	}

	try {
		setIsLoading(true);
		const newState = await handler.submitForm(formId, formData);

		if (await sdk.isAuthenticated) {
			router.push('/profile');
		} else {
			updateStateFromResponse(newState);
		}
	} catch (error) {
		// error handling...
	} finally {
		setIsLoading(false);
	}
};
// ...
```

### 6. Error Handling and Fallback

Error handling is performed inside the `onFormSubmit` function. If an error occurs during form submission and the error is an instance of `FallbackError` and a hosted login URL is available, the user is redirected to the hosted login page. Otherwise, a generic error message is shown.

```tsx
try {
	// form submission logic...
} catch (error) {
	// eslint-disable-next-line no-console
	console.error('Error submitting form:', error);

	if (error instanceof FallbackError && state.hostedUrl) {
		// Fallback to hosted login
		window.location.href = state.hostedUrl;
	} else {
		alert(error.message);
	}
}
```

### 7. Field-Level Messages

Field-level validation and error messages are displayed using the `renderFieldMessage` function. This function checks if there is an error message for a specific field and renders it if present.

```tsx
const renderFieldMessage = (formId: string, fieldName: string) => {
	const fieldMessage = messages[formId]?.[fieldName];

	if (fieldMessage && fieldMessage.type === 'error') {
		return <div className={styles.error}>{fieldMessage.text}</div>;
	}

	return null;
};
```

---

## Key Features and Implementation

### 1. Next.js Dependencies

This Next.js application uses the Strivacity Next.js SDK for authentication (see [package.json](./package.json)):

```json
{
	"@strivacity/sdk-next": "latest"
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
