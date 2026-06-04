import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@uids-io/auth-react";

export function CallbackPage() {
	const { client } = useAuth();
	const navigate = useNavigate();
	const [message, setMessage] = useState("Completing sign-in…");

	useEffect(() => {
		let cancelled = false;

		void client
			.handleCallback(window.location.href)
			.then(() => {
				if (!cancelled) {
					window.history.replaceState({}, "", "/auth/callback");
					navigate("/dashboard", { replace: true });
				}
			})
			.catch((err: unknown) => {
				if (!cancelled) {
					setMessage(
						err instanceof Error ? err.message : "Sign-in failed",
					);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [client, navigate]);

	return (
		<main style={{ fontFamily: "system-ui", margin: "2rem" }}>
			<p>{message}</p>
		</main>
	);
}
