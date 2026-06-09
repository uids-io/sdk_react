import { useNavigate } from "react-router-dom";
import { useAuthCallback } from "@advcomm/uids-io-auth-react";

export function CallbackPage() {
	const navigate = useNavigate();
	const { isProcessing, error } = useAuthCallback({
		onSuccess: () => navigate("/dashboard", { replace: true }),
	});

	return (
		<main style={{ fontFamily: "system-ui", margin: "2rem" }}>
			{error ? <p role="alert">{error.message}</p> : null}
			{isProcessing ? <p>Completing sign-in…</p> : null}
		</main>
	);
}
