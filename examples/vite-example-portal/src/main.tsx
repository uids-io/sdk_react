import { AuthProvider } from "@advcomm/uids-io-auth-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.js";
import { authConfig } from "./auth/config.js";

createRoot(document.getElementById("root") as HTMLElement).render(
	<StrictMode>
		<AuthProvider config={authConfig}>
			<BrowserRouter>
				<App />
			</BrowserRouter>
		</AuthProvider>
	</StrictMode>,
);
