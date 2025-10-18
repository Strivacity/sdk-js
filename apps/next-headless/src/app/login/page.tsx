'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStrivacity, FallbackError, type LoginFlowState, type LoginFlowMessage, type NativeContext } from '@strivacity/sdk-next';
import type { NativeFlowHandler } from 'packages/sdk-core/dist/utils/NativeFlowHandler';
import styles from './page.module.scss';

export default function Login() {
	const router = useRouter();
	const { sdk } = useStrivacity<NativeContext>();
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [handler, setHandler] = useState<NativeFlowHandler | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [screen, setScreen] = useState<string | null>(null);
	const [state, setState] = useState<LoginFlowState>({});
	const [formData, setFormData] = useState<Record<string, unknown>>({});
	const [messages, setMessages] = useState<Record<string, Record<string, LoginFlowMessage>>>({});

	const handleMessages = (newMessages: Record<string, Record<string, LoginFlowMessage>> | undefined) => {
		if (!newMessages) return;

		setMessages({});

		Object.keys(newMessages).forEach((formId) => {
			if (formId === 'global') {
				alert(newMessages.global?.text);
			} else {
				setMessages((prev) => ({
					...prev,
					[formId]: newMessages[formId],
				}));
			}
		});
	};

	const updateStateFromResponse = (data: LoginFlowState) => {
		setState(data);
		handleMessages(data.messages);

		if (data.screen) {
			if (data.screen !== state.screen) {
				setFormData({});
			}

			setScreen(data.screen);
		}
	};

	const initializeSession = async () => {
		try {
			setIsLoading(true);

			if (window.location.search !== '') {
				const url = new URL(window.location.href);
				const sid = url.searchParams.get('session_id');
				setSessionId(sid);
				url.search = '';
				window.history.replaceState({}, '', url.toString());
			}

			const loginHandler = sdk.login({ sdk: 'web-minimal' });
			setHandler(loginHandler);

			const state = await loginHandler.startSession(sessionId);

			if (state) {
				updateStateFromResponse(state);
			}
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error('Login error:', error);
		} finally {
			setIsLoading(false);
		}
	};

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
			// eslint-disable-next-line no-console
			console.error('Error submitting form:', error);

			if (error instanceof FallbackError && state.hostedUrl) {
				// Fallback to hosted login
				window.location.href = state.hostedUrl;
			} else {
				alert(error.message);
			}
		} finally {
			setIsLoading(false);
		}
	};

	const handleInputChange = (field: string, value: string) => {
		setFormData((prev) => ({
			...prev,
			[field]: value,
		}));
	};

	const renderFieldMessage = (formId: string, fieldName: string) => {
		const fieldMessage = messages[formId]?.[fieldName];

		if (fieldMessage && fieldMessage.type === 'error') {
			return <div className={styles.error}>{fieldMessage.text}</div>;
		}

		return null;
	};

	const renderIdentificationForm = () => (
		<form className={styles.form} onSubmit={(e) => void onFormSubmit('identifier', e)}>
			<h2 className={styles.title}>Sign in</h2>
			<div className={styles.inputGroup}>
				<label className={styles.label} htmlFor="identifier">
					Identifier:
				</label>
				<input
					className={styles.input}
					id="identifier"
					type="text"
					value={(formData.identifier as string) || ''}
					onChange={(e) => handleInputChange('identifier', e.target.value)}
					required
				/>
				{renderFieldMessage('identifier', 'identifier')}
			</div>
			<button className={styles.button} type="submit" disabled={isLoading}>
				{isLoading ? 'Loading...' : 'Continue'}
			</button>
		</form>
	);

	const renderPasswordForm = () => (
		<form className={styles.form} onSubmit={(e) => void onFormSubmit('password', e)}>
			<h2 className={styles.title}>Enter password</h2>
			<div className={styles.inputGroup}>
				<label className={styles.label} htmlFor="password">
					Password:
				</label>
				<input
					className={styles.input}
					id="password"
					type="password"
					value={(formData.password as string) || ''}
					onChange={(e) => handleInputChange('password', e.target.value)}
					required
				/>
				{renderFieldMessage('password', 'password')}
			</div>
			<button className={styles.button} type="submit" disabled={isLoading}>
				{isLoading ? 'Loading...' : 'Sign In'}
			</button>
		</form>
	);

	const renderForm = () => {
		switch (screen) {
			case 'identification': {
				return renderIdentificationForm();
			}
			case 'password': {
				return renderPasswordForm();
			}
			default: {
				if (state.hostedUrl) {
					// Fallback to hosted login
					window.location.href = state.hostedUrl;
				}

				return <div>Loading...</div>;
			}
		}
	};

	useEffect(() => {
		void initializeSession();
	}, []);

	if (isLoading && !screen) {
		return <div>Loading...</div>;
	}

	return <section className={styles.container}>{renderForm()}</section>;
}
