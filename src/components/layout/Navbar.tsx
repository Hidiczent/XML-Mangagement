import { Link, NavLink } from "react-router-dom";

export default function Navbar() {
  return (
    <header className="border-b bg-white/70 backdrop-blur">
      <div className="container-page h-14 flex items-center justify-between">
        <Link to="/" className="font-bold text-lg">
          XML Management
        </Link>
        <nav className="flex items-center gap-6">
          <NavLink
            to="/"
            className={({ isActive }) =>
              isActive ? "text-blue-600" : "text-gray-700"
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/about"
            className={({ isActive }) =>
              isActive ? "text-blue-600" : "text-gray-700"
            }
          >
            About
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
