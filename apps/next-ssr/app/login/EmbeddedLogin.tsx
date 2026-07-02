'use client';

export function EmbeddedLogin({ short_app_id, session_id, language }: { short_app_id?: string; session_id?: string; language?: string }) {
	return (
		<section>
			<sty-notifications></sty-notifications>
			<sty-login shortAppId={short_app_id} sessionId={session_id} lang={language}></sty-login>
			<sty-language-selector></sty-language-selector>
		</section>
	);
}
