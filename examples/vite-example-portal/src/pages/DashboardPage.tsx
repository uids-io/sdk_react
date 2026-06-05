import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createAuthFetch, useAuth, useRequireAuth } from "@uids-io/auth-react";
import { apiBaseUrl } from "../auth/config.js";

export function DashboardPage() {
	useRequireAuth();
	const { user, signOut, client, isLoading } = useAuth();
	const [apiResult, setApiResult] = useState<string | null>(null);

	const apiFetch = useMemo(
		() =>
			createAuthFetch(
				() => client.getAccessToken(),
				() => client.refresh(),
				{
					onUnauthorized: () => {
						void client.signIn();
					},
				},
			),
		[client],
	);

	const callApi = useCallback(async () => {
		setApiResult("Loading…");
		try {
			const res = await apiFetch(`${apiBaseUrl}/me`);
			const body = await res.json();
			setApiResult(JSON.stringify(body, null, 2));
		} catch (e) {
			setApiResult(e instanceof Error ? e.message : "Request failed");
		}
	}, [apiFetch]);

	if (isLoading) {
		return <p style={{ margin: "2rem" }}>Loading…</p>;
	}

	return (
		<main style={{ fontFamily: "system-ui", margin: "2rem", maxWidth: 720 }}>
			<h1>Dashboard</h1>
			<p>
				<Link to="/">Home</Link>
			</p>
			{user && (
				<pre style={{ background: "#f4f4f5", padding: "1rem" }}>
					{JSON.stringify(user, null, 2)}
				</pre>
			)}
			<p>
				<button type="button" onClick={() => void callApi()}>
					GET {apiBaseUrl}/me
				</button>{" "}
				<button type="button" onClick={() => void signOut()}>
					Sign out
				</button>
			</p>
			{apiResult && (
				<pre style={{ background: "#f4f4f5", padding: "1rem" }}>{apiResult}</pre>
			)}
		</main>
	);
}
