import { useAuth } from "@advcomm/uids-io-auth-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";

export function HomePage() {
	const {
		isAuthenticated,
		isLoading,
		isLoadingProviders,
		signIn,
		enabledProviders,
		error,
		loadProviders,
	} = useAuth();

	useEffect(() => {
		void loadProviders();
	}, [loadProviders]);

	return (
		<main style={{ fontFamily: "system-ui", margin: "2rem", maxWidth: 640 }}>
			<h1>Merchant portal (example)</h1>
			<p>
				Demo app for <code>@advcomm/uids-io-auth-react</code> against{" "}
				<code>@advcomm/uids-io-auth</code>.
			</p>

			{isLoading && <p>Loading session…</p>}
			{isLoadingProviders && !isLoading && <p>Loading sign-in options…</p>}

			{error && (
				<p role="alert" style={{ color: "crimson" }}>
					{error.message}
				</p>
			)}

			{!isLoading && !isLoadingProviders && !isAuthenticated && (
				<div style={{ display: "grid", gap: "0.5rem", maxWidth: 280 }}>
					{enabledProviders.includes("google") && (
						<button
							type="button"
							onClick={() => void signIn({ provider: "google" })}
						>
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
						<button
							type="button"
							onClick={() => void signIn({ provider: "email" })}
						>
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
