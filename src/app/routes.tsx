// src/router.tsx (หรือไฟล์ที่คุณประกาศ router)
import { createBrowserRouter, Navigate } from "react-router-dom";

import MainLayout from "@/layouts/MainLayout";
import HomePage from "@/features/home/pages/HomePage";
import Audit_log from "@/features/home/pages/Audit_log";
import ServiceBrowser from "@/pages/ServiceBrowser";
import NotFoundPage from "@/pages/NotFoundPage";
import UploadXml from "@/components/UploadXml";
import SignInForm from "@/features/home/components/Auth/SignInForm";
import Profile from "@/features/home/pages/Profile";
import Report from "@/features/home/pages/Report";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <HomePage /> },

      // --- Service Browser ---
      { path: "service", element: <ServiceBrowser /> },
      { path: "Services", element: <Navigate to="/service" replace /> },

      // --- Manage editor ---
      { path: "manage", element: <UploadXml /> }, // รองรับ ?fileId=...&version=...
      { path: "manage/:fileId", element: <UploadXml /> }, // รองรับ /manage/:fileId

      { path: "SignInForm", element: <SignInForm /> },
      { path: "Report", element: <Report /> },
      { path: "Audit_log", element: <Audit_log /> },
      { path: "Profile", element: <Profile /> },

      // 404 ภายใต้ MainLayout
      { path: "*", element: <NotFoundPage /> },
    ],
  },

  // 404 เผื่อกรณีหลุดนอก layout
  { path: "*", element: <NotFoundPage /> },
]);
