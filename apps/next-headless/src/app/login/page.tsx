'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LoginFlowState, LoginFlowMessage, NativeContext, StaticWidget, SubmitWidget, MultiSelectWidget, InputWidget } from '@strivacity/sdk-next';
import type { NativeFlowHandler } from 'packages/sdk-core/dist/utils/NativeFlowHandler';
import { useStrivacity, FallbackError } from '@strivacity/sdk-next';

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
		setMessages({});

		if (newMessages) {
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
		}
	};

	const updateStateFromResponse = (data: LoginFlowState) => {
		handleMessages(data.messages);

		if (!data.messages) {
			setState(data);
		}

		if (data.screen) {
			if (data.screen !== state.screen) {
				setFormData({});

				if (data.screen === 'registration') {
					const widgets = data.forms?.find((f) => f.id === 'registration')?.widgets || [];
					const emailWidget = widgets.find((w) => w.id === 'email') as InputWidget;

					setFormData({ email: emailWidget?.value || '' });
				} else if (data.screen === 'mfaEnrollTargetSelect') {
					const widgets = data.forms?.find((f) => f.id === 'mfaEnrollTargetSelect')?.widgets || [];
					const targetWidget = widgets.find((w) => w.id === 'target') as InputWidget;

					setFormData({ target: targetWidget?.value || '' });
				}
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

	const onFormSubmit = async (formId: string, event: React.FormEvent, onBeforeSubmit?: (data: Record<string, unknown>) => Promise<void> | void) => {
		event.preventDefault();

		if (!handler) {
			return;
		}

		const data = formData;

		try {
			setIsLoading(true);
			await onBeforeSubmit?.(data);
			const newState = await handler.submitForm(formId, data);

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

	const handleInputChange = (field: string, value: unknown) => {
		setFormData((prev) => ({
			...prev,
			[field]: value,
		}));
	};

	const handleMultiSelectChange = (field: string, value: string) => {
		const currentValues = (formData[field] as string[]) || [];
		const newValues = currentValues.includes(value) ? currentValues.filter((v) => v !== value) : [...currentValues, value];

		setFormData((prev) => ({
			...prev,
			[field]: newValues,
		}));
	};

	const renderFieldMessage = (formId: string, fieldName: string) => {
		const fieldMessage = messages[formId]?.[fieldName];

		if (fieldMessage && fieldMessage.type === 'error') {
			return <div className="error">{fieldMessage.text}</div>;
		}

		return null;
	};

	const renderAccountInfo = () => {
		const accountEmail = (state.forms?.find((form) => form.id === 'reset')?.widgets.find((widget) => widget.id === 'identifier') as StaticWidget)?.value;

		if (!accountEmail) {
			return null;
		}

		return (
			<div data-widget="layout" data-type="horizontal" data-form-id="reset">
				<div data-widget="static" data-form-id="reset" data-widget-id="identifier">
					{accountEmail}
				</div>
				<a data-widget="submit" data-type="link" data-form-id="reset" data-widget-id="not-you" tabIndex={0} onClick={(e) => void onFormSubmit('reset', e)}>
					Not you?
				</a>
			</div>
		);
	};

	const renderBackToLogin = () => {
		const hasResetForm = state.forms?.some((form) => form.id === 'reset');

		if (!hasResetForm) {
			return null;
		}

		return (
			<a tabIndex={0} onClick={(e) => void onFormSubmit('reset', e)} data-widget="submit" data-type="link" data-form-id="reset" data-widget-id="submit">
				Back to login
			</a>
		);
	};

	const renderIdentificationForm = () => (
		<form onSubmit={(e) => void onFormSubmit('identifier', e)} data-widget="layout" data-type="vertical" data-form-id="identifier">
			<h1 data-widget="static" data-form-id="identifier" data-widget-id="section-title">
				Sign in
			</h1>
			<div data-widget="input" data-form-id="identifier" data-widget-id="identifier">
				<input
					id="identifier"
					name="identifier"
					autoComplete="username"
					placeholder="Email address"
					inputMode="email"
					type="text"
					size={1}
					value={(formData['identifier'] as string) || ''}
					onChange={(e) => handleInputChange('identifier', e.target.value)}
					required
				/>
				{renderFieldMessage('identifier', 'identifier')}
			</div>
			<button
				type="submit"
				disabled={isLoading}
				data-widget="submit"
				data-type="button"
				data-variant="primary"
				data-form-id="identifier"
				data-widget-id="submit"
			>
				{isLoading ? 'Loading...' : 'Continue'}
			</button>
			{state.forms
				?.filter((form) => form.id.startsWith('externalLoginProvider/'))
				.map((form) => (
					<button
						key={form.id}
						type="button"
						onClick={(e) => void onFormSubmit(form.id, e)}
						data-widget="submit"
						data-type="button"
						data-form-id={form.id}
						data-widget-id="submit"
					>
						{(form.widgets[0] as SubmitWidget).label}
					</button>
				))}
			<div data-widget="layout" data-type="horizontal" data-form-id="additionalActions/registration">
				<div data-widget="static" data-form-id="additionalActions/registration" data-widget-id="dont-have-an-account">
					Don't have an account?
				</div>
				<a
					tabIndex={0}
					onClick={(e) => void onFormSubmit('additionalActions/registration', e)}
					data-widget="submit"
					data-type="link"
					data-form-id="additionalActions/registration"
					data-widget-id="submit"
				>
					Sign up
				</a>
			</div>
		</form>
	);

	const renderPasswordForm = () => (
		<form onSubmit={(e) => void onFormSubmit('password', e)} data-widget="layout" data-type="vertical" data-form-id="password">
			<h1 data-widget="static" data-form-id="password" data-widget-id="section-title">
				Enter password
			</h1>
			{renderAccountInfo()}
			<div data-widget="password" data-form-id="password" data-widget-id="password">
				<input
					id="password"
					name="password"
					type="password"
					placeholder="Enter your password"
					size={1}
					value={(formData['password'] as string) || ''}
					onChange={(e) => handleInputChange('password', e.target.value)}
					required
				/>
				{renderFieldMessage('password', 'password')}
			</div>
			<div data-widget="checkbox" data-form-id="password" data-widget-id="keepMeLoggedIn">
				<input
					id="keepMeLoggedIn"
					name="keepMeLoggedIn"
					type="checkbox"
					checked={(formData['keepMeLoggedIn'] as boolean) || false}
					disabled={isLoading}
					onChange={(e) => handleInputChange('keepMeLoggedIn', e.target.checked)}
				/>
				<label htmlFor="keepMeLoggedIn" className="label">
					Keep me logged in
				</label>
				{renderFieldMessage('password', 'keepMeLoggedIn')}
			</div>
			<button type="submit" disabled={isLoading} data-widget="submit" data-type="button" data-variant="primary" data-form-id="password" data-widget-id="submit">
				{isLoading ? 'Loading...' : 'Continue'}
			</button>
			{renderBackToLogin()}
		</form>
	);

	const renderRegistrationForm = () => (
		<form onSubmit={(e) => void onFormSubmit('registration', e)} data-widget="layout" data-type="vertical" data-form-id="registration">
			<h1 data-widget="static" data-form-id="registration" data-widget-id="section-title">
				Sign up
			</h1>
			<div data-widget="input" data-form-id="registration" data-widget-id="email">
				<input
					id="email"
					name="email"
					autoComplete="username"
					inputMode="email"
					type="text"
					size={1}
					placeholder="Email"
					value={(formData['email'] as string) || ''}
					onChange={(e) => handleInputChange('email', e.target.value)}
					required
				/>
				{renderFieldMessage('registration', 'email')}
			</div>
			<div data-widget="password" data-form-id="registration" data-widget-id="password">
				<input
					id="password"
					name="password"
					type="password"
					size={1}
					placeholder="Password"
					value={(formData['password'] as string) || ''}
					onChange={(e) => handleInputChange('password', e.target.value)}
					required
				/>
				{renderFieldMessage('registration', 'password')}
			</div>
			<div data-widget="password" data-form-id="registration" data-widget-id="passwordConfirmation">
				<input
					id="passwordConfirmation"
					name="passwordConfirmation"
					type="password"
					size={1}
					placeholder="Re-type password"
					value={(formData['passwordConfirmation'] as string) || ''}
					onChange={(e) => handleInputChange('passwordConfirmation', e.target.value)}
					required
				/>
				{renderFieldMessage('registration', 'passwordConfirmation')}
			</div>
			<div data-widget="checkbox" data-form-id="password" data-widget-id="keepMeLoggedIn">
				<input
					id="keepMeLoggedIn"
					name="keepMeLoggedIn"
					type="checkbox"
					checked={(formData['keepMeLoggedIn'] as boolean) || false}
					disabled={isLoading}
					onChange={(e) => handleInputChange('keepMeLoggedIn', e.target.checked)}
				/>
				<label htmlFor="keepMeLoggedIn" className="label">
					Keep me logged in
				</label>
				{renderFieldMessage('registration', 'keepMeLoggedIn')}
			</div>
			<button
				type="submit"
				disabled={isLoading}
				data-widget="submit"
				data-type="button"
				data-variant="primary"
				data-form-id="registration"
				data-widget-id="submit"
			>
				{isLoading ? 'Loading...' : 'Continue'}
			</button>
			{state.forms
				?.filter((form) => form.id.startsWith('externalLoginProvider/'))
				.map((form) => (
					<button
						key={form.id}
						type="button"
						onClick={(e) => void onFormSubmit(form.id, e)}
						data-widget="submit"
						data-type="button"
						data-form-id={form.id}
						data-widget-id="submit"
					>
						{(form.widgets[0] as SubmitWidget).label}
					</button>
				))}
			{renderBackToLogin()}
		</form>
	);

	const renderMFAEnrollStartForm = () => {
		const mfaEnrollStartForm = state.forms?.find((form) => form.id === 'mfaEnrollStart');
		const optionalWidget = mfaEnrollStartForm?.widgets?.find((w) => w.id === 'optional' && w.type === 'multiSelect') as MultiSelectWidget;
		const mandatoryWidget = mfaEnrollStartForm?.widgets?.find((w) => w.id === 'mandatory' && w.type === 'multiSelect') as MultiSelectWidget;

		if (!mfaEnrollStartForm || (!optionalWidget && !mandatoryWidget)) {
			return null;
		}

		const optionalValues = (formData['optional'] as string[]) || [];
		const mandatoryValues = (formData['mandatory'] as string[]) || [];

		return (
			<form onSubmit={(e) => void onFormSubmit('mfaEnrollStart', e)} data-widget="layout" data-type="vertical" data-form-id="mfaEnrollStart">
				<h1 data-widget="static" data-form-id="registration" data-widget-id="section-title">
					Enroll the following authentication methods
				</h1>
				{renderAccountInfo()}
				{optionalWidget && (
					<>
						<div data-widget="static" data-form-id="mfaEnrollStart" data-widget-id="optional-title">
							{optionalWidget.label || 'Choose at least one method'}
						</div>
						<div data-widget="multiselect" data-form-id="mfaEnrollStart" data-widget-id={optionalWidget.id}>
							{optionalWidget.options?.map((option) =>
								option.type === 'group' ? (
									<div key={option.label} className="item">
										<p>{option.label}</p>
										{option.options?.map((subOption) => (
											<div key={subOption.value}>
												<input
													id={`optional-${subOption.value}`}
													type="checkbox"
													name={optionalWidget.id}
													value={subOption.value}
													checked={optionalValues.includes(subOption.value)}
													onChange={(e) => handleMultiSelectChange(optionalWidget.id, e.target.value)}
												/>
												<label htmlFor={`optional-${subOption.value}`}>{subOption.label}</label>
											</div>
										))}
									</div>
								) : (
									<div key={option.label} className="item">
										<input
											id={`optional-${option.value}`}
											type="checkbox"
											name={optionalWidget.id}
											value={option.value}
											checked={optionalValues.includes(option.value)}
											onChange={(e) => handleMultiSelectChange(optionalWidget.id, e.target.value)}
										/>
										<label htmlFor={`optional-${option.value}`}>{option.label}</label>
									</div>
								),
							)}
							{renderFieldMessage('mfaEnrollStart', optionalWidget.id)}
						</div>
					</>
				)}

				{mandatoryWidget && (
					<>
						<div data-widget="static" data-form-id="mfaEnrollStart" data-widget-id="mandatory-title">
							{mandatoryWidget.label || 'Required methods'}
						</div>
						<div data-widget="multiselect" data-form-id="mfaEnrollStart" data-widget-id={mandatoryWidget.id}>
							{mandatoryWidget.options?.map((option) =>
								option.type === 'group' ? (
									<div key={option.label} className="item">
										<p>{option.label}</p>
										{option.options?.map((subOption) => (
											<div key={subOption.value}>
												<input
													id={`mandatory-${subOption.value}`}
													type="checkbox"
													name={mandatoryWidget.id}
													value={subOption.value}
													checked={mandatoryValues.includes(subOption.value)}
													onChange={(e) => handleMultiSelectChange(mandatoryWidget.id, e.target.value)}
												/>
												<label htmlFor={`mandatory-${subOption.value}`}>{subOption.label}</label>
											</div>
										))}
									</div>
								) : (
									<div key={option.label} className="item">
										<input
											id={`mandatory-${option.value}`}
											type="checkbox"
											name={mandatoryWidget.id}
											value={option.value}
											checked={mandatoryValues.includes(option.value)}
											onChange={(e) => handleMultiSelectChange(mandatoryWidget.id, e.target.value)}
										/>
										<label htmlFor={`mandatory-${option.value}`}>{option.label}</label>
									</div>
								),
							)}
							{renderFieldMessage('mfaEnrollStart', mandatoryWidget.id)}
						</div>
					</>
				)}

				<button
					type="submit"
					disabled={isLoading}
					data-widget="submit"
					data-type="button"
					data-variant="primary"
					data-form-id="mfaEnrollStart"
					data-widget-id="submit"
				>
					{isLoading ? 'Loading...' : 'Continue'}
				</button>

				{renderBackToLogin()}
			</form>
		);
	};

	const renderMFAEnrollTargetSelectForm = () => {
		const mfaEnrollTargetSelectForm = state.forms?.find((form) => form.id === 'mfaEnrollTargetSelect');
		const selectDifferentMethodForm = state.forms?.find((form) => form.id === 'additionalActions/selectDifferentMethod');

		if (!mfaEnrollTargetSelectForm) {
			return null;
		}

		const title = (mfaEnrollTargetSelectForm.widgets?.find((w) => w.id === 'section-title') as StaticWidget)?.value || 'Verify your MFA';
		const targetWidget = mfaEnrollTargetSelectForm.widgets?.find((w) => w.id === 'target');

		const onBeforeSubmit = (data: Record<string, unknown>) => {
			// Automatically set method to 'passcode' for MFA enroll target select
			data['method'] = 'passcode';
		};

		return (
			<form
				onSubmit={(e) => void onFormSubmit('mfaEnrollTargetSelect', e, onBeforeSubmit)}
				data-widget="layout"
				data-type="vertical"
				data-form-id="mfaEnrollTargetSelect"
			>
				<div data-widget="static" data-form-id="mfaEnrollTargetSelect" data-widget-id="section-title">
					{title}
				</div>
				{renderAccountInfo()}

				<div data-widget="input" data-form-id="mfaEnrollTargetSelect" data-widget-id="target">
					<input
						id="target"
						name="target"
						type="text"
						placeholder={targetWidget?.type === 'phone' ? 'Your phone number' : 'Your email address'}
						value={(formData['target'] as string) || ''}
						onChange={(e) => handleInputChange('target', e.target.value)}
						required
					/>
					{renderFieldMessage('mfaEnrollTargetSelect', 'target')}
				</div>
				<button
					type="submit"
					disabled={isLoading}
					data-widget="submit"
					data-type="button"
					data-variant="primary"
					data-form-id="mfaEnrollTargetSelect"
					data-widget-id="submit"
				>
					{isLoading ? 'Loading...' : 'Continue'}
				</button>

				{selectDifferentMethodForm && (
					<button
						type="button"
						onClick={(e) => void onFormSubmit('additionalActions/selectDifferentMethod', e)}
						data-widget="submit"
						data-type="button"
						data-form-id="additionalActions/selectDifferentMethod"
						data-widget-id="submit"
					>
						Select different method to enroll
					</button>
				)}

				{renderBackToLogin()}
			</form>
		);
	};

	const renderMFAEnrollChallengeForm = () => {
		const mfaEnrollChallengeForm = state.forms?.find((form) => form.id === 'mfaEnrollChallenge');
		const passcodeWidget = mfaEnrollChallengeForm?.widgets.find((widget) => widget.type === 'passcode');
		const sectionTitle = (mfaEnrollChallengeForm?.widgets.find((w) => w.id === 'section-title') as StaticWidget)?.value || 'Verify by using a passcode';
		const passcodeText = (mfaEnrollChallengeForm?.widgets.find((w) => w.id === 'we-sent-a-passcode-to') as StaticWidget)?.value || 'We sent a passcode';

		return (
			<form onSubmit={(e) => void onFormSubmit('mfaEnrollChallenge', e)} data-widget="layout" data-type="vertical" data-form-id="mfaEnrollChallenge">
				<div data-widget="static" data-form-id="mfaEnrollChallenge" data-widget-id="section-title">
					{sectionTitle}
				</div>
				{renderAccountInfo()}
				<div data-widget="static" data-form-id="mfaEnrollChallenge" data-widget-id="we-sent-a-passcode-to">
					{passcodeText}
				</div>
				<div data-widget="passcode" data-form-id="mfaEnrollChallenge" data-widget-id="passcode">
					<input
						id="passcode"
						name="passcode"
						type="text"
						placeholder={passcodeWidget?.label || 'Passcode'}
						minLength={passcodeWidget?.validator?.length || 6}
						maxLength={passcodeWidget?.validator?.length || 6}
						autoComplete="off"
						inputMode="numeric"
						size={1}
						value={(formData['passcode'] as string) || ''}
						onInput={(e) => {
							const inputElement = e.target as HTMLInputElement;
							inputElement.value = inputElement.value.replace(/\D/g, '');
						}}
						onChange={(e) => handleInputChange('passcode', e.target.value)}
						required
					/>
					{renderFieldMessage('mfaEnrollChallenge', 'passcode')}
				</div>
				<button
					type="submit"
					disabled={isLoading}
					data-widget="submit"
					data-type="button"
					data-variant="primary"
					data-form-id="mfaEnrollChallenge"
					data-widget-id="submit"
				>
					{isLoading ? 'Loading...' : 'Confirm'}
				</button>
				<div data-widget="layout" data-type="horizontal" data-form-id="additionalActions/resend">
					<div data-widget="static" data-form-id="additionalActions/resend" data-widget-id="resend-text">
						Didn't receive the email?
					</div>
					<a
						tabIndex={0}
						onClick={(e) => void onFormSubmit('additionalActions/resend', e)}
						data-widget="submit"
						data-type="link"
						data-form-id="additionalActions/resend"
						data-widget-id="submit"
					>
						Resend
					</a>
				</div>
				<button
					type="button"
					onClick={(e) => void onFormSubmit('additionalActions/selectDifferentMethod', e)}
					data-widget="submit"
					data-type="button"
					data-form-id="additionalActions/selectDifferentMethod"
					data-widget-id="submit"
				>
					Select different method to enroll
				</button>

				{renderBackToLogin()}
			</form>
		);
	};

	const renderMFAMethodForm = () => {
		const mfaMethodForm = state.forms?.find((form) => form.id === 'mfaMethod');
		const selectWidget = mfaMethodForm?.widgets.find((widget) => widget.type === 'select');

		if (!selectWidget || !selectWidget.options) {
			return null;
		}

		return (
			<form onSubmit={(e) => void onFormSubmit('mfaMethod', e)} data-widget="layout" data-type="vertical" data-form-id="mfaMethod">
				<div data-widget="static" data-form-id="mfaMethod" data-widget-id="section-title">
					{(mfaMethodForm?.widgets.find((w) => w.id === 'section-title') as StaticWidget)?.value || 'Choose a multi-factor method'}
				</div>
				{renderAccountInfo()}
				<div data-widget="select" data-form-id="mfaMethod" data-widget-id={selectWidget.id}>
					{selectWidget.options.map((option) =>
						option.type === 'group' ? (
							<div key={option.label} className="group">
								<p>{option.label}</p>
								{option.options?.map((subOption) => (
									<div key={subOption.value} className="item">
										<input
											id={subOption.value}
											type="radio"
											name={selectWidget.id}
											value={subOption.value}
											checked={(formData[selectWidget.id] as string) === subOption.value}
											onChange={(e) => handleInputChange(selectWidget.id, e.target.value)}
											required
										/>
										<label htmlFor={subOption.value}>{subOption.label}</label>
									</div>
								))}
							</div>
						) : (
							<div key={option.value} className="item">
								<input
									id={option.value}
									type="radio"
									name={selectWidget.id}
									value={option.value}
									checked={(formData[selectWidget.id] as string) === option.value}
									onChange={(e) => handleInputChange(selectWidget.id, e.target.value)}
									required
								/>
								<label htmlFor={option.value}>{option.label}</label>
							</div>
						),
					)}
					{renderFieldMessage('mfaMethod', selectWidget.id)}
				</div>
				<button
					type="submit"
					disabled={isLoading}
					data-widget="submit"
					data-type="button"
					data-variant="primary"
					data-form-id="mfaMethod"
					data-widget-id="submit"
				>
					{isLoading ? 'Loading...' : 'Continue'}
				</button>

				{renderBackToLogin()}
			</form>
		);
	};

	const renderMFAPasscodeForm = () => {
		const mfaPasscodeForm = state.forms?.find((form) => form.id === 'mfaPasscode');
		const passcodeWidget = mfaPasscodeForm?.widgets.find((widget) => widget.type === 'passcode');
		const sectionTitle = (mfaPasscodeForm?.widgets.find((w) => w.id === 'section-title') as StaticWidget)?.value || 'Enter passcode';
		const passcodeText =
			(mfaPasscodeForm?.widgets.find((w) => w.id === 'we-sent-a-passcode-to') as StaticWidget)?.value || 'We sent a passcode to your email address';

		return (
			<form onSubmit={(e) => void onFormSubmit('mfaPasscode', e)} data-widget="layout" data-type="vertical" data-form-id="mfaPasscode">
				<div data-widget="static" data-form-id="mfaPasscode" data-widget-id="section-title">
					{sectionTitle}
				</div>
				{renderAccountInfo()}
				<div data-widget="static" data-form-id="mfaPasscode" data-widget-id="we-sent-a-passcode-to">
					{passcodeText}
				</div>
				<div data-widget="passcode" data-form-id="mfaPasscode" data-widget-id="passcode">
					<input
						id="passcode"
						name="passcode"
						type="text"
						placeholder={passcodeWidget?.label || 'Passcode'}
						minLength={passcodeWidget?.validator?.length || 6}
						maxLength={passcodeWidget?.validator?.length || 6}
						autoComplete="off"
						inputMode="numeric"
						size={1}
						value={(formData['passcode'] as string) || ''}
						onInput={(e) => {
							const inputElement = e.target as HTMLInputElement;
							inputElement.value = inputElement.value.replace(/\D/g, '');
						}}
						onChange={(e) => handleInputChange('passcode', e.target.value)}
						required
					/>
					{renderFieldMessage('mfaPasscode', 'passcode')}
				</div>
				<button
					type="submit"
					disabled={isLoading}
					data-widget="submit"
					data-type="button"
					data-variant="primary"
					data-form-id="mfaPasscode"
					data-widget-id="submit"
				>
					{isLoading ? 'Loading...' : 'Confirm'}
				</button>
				<div data-widget="layout" data-type="horizontal" data-form-id="additionalActions/resend">
					<div data-widget="static" data-form-id="additionalActions/resend" data-widget-id="resend">
						Didn't receive the email?
					</div>
					<a
						tabIndex={0}
						onClick={(e) => void onFormSubmit('additionalActions/resend', e)}
						data-widget="submit"
						data-type="link"
						data-form-id="additionalActions/resend"
						data-widget-id="submit"
					>
						Resend
					</a>
				</div>

				{renderBackToLogin()}
			</form>
		);
	};

	const renderGenericResultForm = () => {
		const genericResultForm = state.forms?.find((form) => form.id === 'genericResult');
		const title = (genericResultForm?.widgets.find((w) => w.id === 'section-title') as StaticWidget)?.value;
		const text = (genericResultForm?.widgets.find((w) => w.id === 'generic-result-text') as StaticWidget)?.value;
		const button = genericResultForm?.widgets.find((w) => w.type === 'submit');

		if (!genericResultForm) {
			return null;
		}

		return (
			<form onSubmit={(e) => void onFormSubmit('genericResult', e)} data-widget="layout" data-type="vertical" data-form-id="genericResult">
				{title && (
					<div data-widget="static" data-form-id="genericResult" data-widget-id="section-title">
						{title}
					</div>
				)}
				{text && (
					<div data-widget="static" data-form-id="genericResult" data-widget-id="generic-result-text">
						{text}
					</div>
				)}
				{button && (
					<button
						type="submit"
						disabled={isLoading}
						data-widget="submit"
						data-type="button"
						data-variant="primary"
						data-form-id="genericResult"
						data-widget-id="submit"
					>
						{isLoading ? 'Loading...' : button.label || 'Continue'}
					</button>
				)}
			</form>
		);
	};

	const renderForm = () => {
		switch (screen) {
			case 'identification': {
				return renderIdentificationForm();
			}
			case 'password': {
				return renderPasswordForm();
			}
			case 'registration': {
				return renderRegistrationForm();
			}
			case 'mfaEnrollStart': {
				return renderMFAEnrollStartForm();
			}
			case 'mfaEnrollTargetSelect': {
				return renderMFAEnrollTargetSelectForm();
			}
			case 'mfaEnrollChallenge': {
				return renderMFAEnrollChallengeForm();
			}
			case 'mfaMethod': {
				return renderMFAMethodForm();
			}
			case 'mfaPasscode': {
				return renderMFAPasscodeForm();
			}
			case 'genericResult': {
				return renderGenericResultForm();
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

	return (
		<section>
			<div className="login-renderer">{renderForm()}</div>
		</section>
	);
}
