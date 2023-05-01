import { createBrowserRouter, createRoot, RouterProvider } from "./deps.ts";
import LoginPage from "./pages/Login.tsx";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

const router = createBrowserRouter([
	{
		path: "/",
		element: <LoginPage />,
	},
], {
	basename: "/auth",
});

root.render(<RouterProvider router={router} />);
