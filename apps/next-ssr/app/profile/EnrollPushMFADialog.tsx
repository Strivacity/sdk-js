/* eslint-disable @next/next/no-img-element */
'use client';

import { useRef, useState } from 'react';
import QRCode from 'qrcode';

export function EnrollPushMFADialog() {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
	const [expiresAt, setExpiresAt] = useState<number | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleEnroll() {
		setLoading(true);
		setError(null);
		setQrDataUrl(null);

		try {
			const res = await fetch('/api/authenticators/token', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			});

			if (!res.ok) {
				throw new Error(`Failed to generate enroll token: ${res.status}`);
			}

			const { token, expiresAt: exp } = (await res.json()) as { token: string; expiresAt: number };
			const dataUrl = await QRCode.toDataURL(token, { width: 256 });

			setQrDataUrl(dataUrl);
			setExpiresAt(exp);

			dialogRef.current?.showModal();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Unknown error');
		} finally {
			setLoading(false);
		}
	}

	function handleClose() {
		dialogRef.current?.close();
		setQrDataUrl(null);
		setExpiresAt(null);
		setError(null);
	}

	return (
		<>
			<button onClick={() => void handleEnroll()} disabled={loading} data-button="pushMFA-enroll">
				{loading ? 'Generating QR code...' : 'Register Device'}
			</button>
			<dialog ref={dialogRef}>
				<button onClick={handleClose} style={{ float: 'right' }}>
					✕
				</button>
				<h2>Register Device</h2>
				{loading && <p>Generating QR code...</p>}
				{error && <p style={{ color: 'red' }}>{error}</p>}
				{qrDataUrl && (
					<>
						<img src={qrDataUrl} alt="Enroll QR code" width={256} height={256} />
						{expiresAt && <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#666' }}>Expires at: {new Date(expiresAt).toLocaleTimeString()}</p>}
					</>
				)}
			</dialog>
		</>
	);
}
