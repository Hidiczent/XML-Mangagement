import { Outlet } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function MainLayout() {
  return (
    <div className="min-h-dvh flex flex-col">
      <Navbar />
      <main className="flex-1 py-8">
        <div className="container-page">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  );
}
