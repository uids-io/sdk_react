import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@advcomm/uids-io-auth-react";
import { authConfig } from "./auth/config.js";
import { App } from "./App.js";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<AuthProvider config={authConfig}>
			<BrowserRouter>
				<App />
			</BrowserRouter>
		</AuthProvider>
	</StrictMode>,
);
