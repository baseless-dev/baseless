import { createBrowserRouter, createRoot, RouterProvider } from "./deps.ts";
import ChoicePage from "./pages/Choice.tsx";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

const router = createBrowserRouter([
	{
		path: "/",
		element: <ChoicePage />,
	},
], {
	basename: "/auth",
});

root.render(<RouterProvider router={router} />);
