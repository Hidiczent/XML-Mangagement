import { Link, NavLink } from "react-router-dom";
export default function Navbar() {
  return (
    <header className="border-b bg-white/70 backdrop-blur m-5 ">
      <div className="container-page h-14 flex items-center justify-between ">
        <Link to="/" className="font-bold text-lg">
          XML Management
        </Link>
        <nav className="flex items-center gap-6">
          <NavLink
            to="/"
            className={({ isActive }) =>
              isActive ? "text-primary" : "text-gray-700"
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/Services"
            className={({ isActive }) =>
              isActive ? "text-primary" : "text-gray-700"
            }
          >
            Service
          </NavLink>
          <NavLink
            to="/Audit_log"
            className={({ isActive }) =>
              isActive ? "text-primary" : "text-gray-700"
            }
          >
            Audit logs
          </NavLink>
          <NavLink
            to="/Report"
            className={({ isActive }) =>
              isActive ? "text-primary" : "text-gray-700"
            }
          >
            Report
          </NavLink>
          <NavLink
            to="/Profile"
            className={({ isActive }) =>
              isActive ? "text-primary" : "text-gray-700"
            }
          >
            Profile
          </NavLink>

          <NavLink
            to="/SignInForm"
            className={({ isActive }) =>
              isActive ? "text-primary" : "text-gray-700"
            }
          >
            SignIn
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
