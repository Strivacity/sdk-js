import { useStrivacity } from '@strivacity/sdk-solid/client';

export default function Header() {
	const ctx = useStrivacity();
	const name = () => `${ctx.idTokenClaims()?.given_name ?? ''} ${ctx.idTokenClaims()?.family_name ?? ''}`.trim();

	return (
		<header>
			<div>{!ctx.loading() && ctx.isAuthenticated() && <strong>Welcome, {name()}!</strong>}</div>
			<div>
				{!ctx.loading() && (
					<>
						<a href="/" data-button="home">
							Home
						</a>
						{ctx.isAuthenticated() ? (
							<>
								<a href="/profile" data-button="profile">
									Profile
								</a>
								<a href="/revoke" data-button="revoke">
									Revoke
								</a>
								<a href="/logout" data-button="logout">
									Logout
								</a>
							</>
						) : (
							<>
								<a href="/login" data-button="login">
									Login
								</a>
								<a href="/register" data-button="register">
									Register
								</a>
							</>
						)}
					</>
				)}
			</div>
		</header>
	);
}
