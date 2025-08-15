import { createBrowserRouter } from "react-router-dom";
import MainLayout from "@/layouts/MainLayout";
import HomePage from "@/features/home/pages/HomePage";
import NotFoundPage from "@/pages/NotFoundPage";
import Report from "../features/home/components/Auth/Report";
import SignInForm from "../features/home/components/Auth/SignInForm";
import Audit_log from "../features/home/components/Auth/Audit_log";
import Profile from "../features/home/components/Auth/Profile";


export const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "SignInForm", element: <SignInForm /> },
      { path: "Report", element: <Report /> },
      { path: "Audit_log", element: <Audit_log /> },
      { path: "Profile", element: <Profile /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
