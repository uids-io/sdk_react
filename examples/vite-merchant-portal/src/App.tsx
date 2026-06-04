import { Route, Routes } from "react-router-dom";
import { CallbackPage } from "./pages/CallbackPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { HomePage } from "./pages/HomePage.js";

export function App() {
	return (
		<Routes>
			<Route path="/" element={<HomePage />} />
			<Route path="/auth/callback" element={<CallbackPage />} />
			<Route path="/dashboard" element={<DashboardPage />} />
		</Routes>
	);
}
