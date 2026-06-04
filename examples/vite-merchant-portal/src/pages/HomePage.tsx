import { Link } from "react-router-dom";
import { useAuth } from "@uids-io/auth-react";

export function HomePage() {
	const {
		isAuthenticated,
		isLoading,
		signIn,
		enabledProviders,
		error,
	} = useAuth();

	return (
		<main style={{ fontFamily: "system-ui", margin: "2rem", maxWidth: 640 }}>
			<h1>Merchant portal (example)</h1>
			<p>
				Demo app for <code>@uids-io/auth-react</code> against{" "}
				<code>@advcomm/uids-io-auth</code>.
			</p>

			{isLoading && <p>Loading session…</p>}

			{error && (
				<p role="alert" style={{ color: "crimson" }}>
					{error.message}
				</p>
			)}

			{!isLoading && !isAuthenticated && (
				<div style={{ display: "grid", gap: "0.5rem", maxWidth: 280 }}>
					{enabledProviders.includes("google") && (
						<button type="button" onClick={() => void signIn({ provider: "google" })}>
							Continue with Google
						</button>
					)}
					{enabledProviders.includes("microsoft") && (
						<button
							type="button"
							onClick={() => void signIn({ provider: "microsoft" })}
						>
							Continue with Microsoft
						</button>
					)}
					{enabledProviders.includes("email") && (
						<button type="button" onClick={() => void signIn({ provider: "email" })}>
							Sign in with email
						</button>
					)}
					<button type="button" onClick={() => void signIn()}>
						Sign in (auth server chooser)
					</button>
				</div>
			)}

			{!isLoading && isAuthenticated && (
				<p>
					Signed in. <Link to="/dashboard">Go to dashboard</Link>
				</p>
			)}
		</main>
	);
}
