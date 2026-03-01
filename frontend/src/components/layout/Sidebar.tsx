import { useState, useRef, useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  FileText,
  Settings,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import ThemeToggle from "./ThemeToggle";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/feedback", icon: MessageSquare, label: "Feedback" },
  { to: "/customers", icon: Users, label: "Customers" },
  { to: "/specs", icon: FileText, label: "Specs" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  return (
    <aside className="w-60 flex flex-col bg-gray-900 border-r border-gray-800 min-h-screen">
      <div className="p-4 border-b border-gray-800">
        <h1 className="font-semibold text-gray-100">Context Engine</h1>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? "bg-blue-500 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-gray-100"
              }`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-2 border-t border-gray-800 space-y-1">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive
                ? "bg-blue-500 text-white"
                : "text-gray-300 hover:bg-gray-800 hover:text-gray-100"
            }`
          }
        >
          <Settings className="w-5 h-5" />
          Settings
        </NavLink>
        <div className="flex items-center justify-between px-3 py-2">
          <ThemeToggle />
        </div>
        {user && (
          <div className="relative px-3 py-2" ref={menuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 w-full text-left text-gray-300 hover:text-gray-100"
            >
              <span className="truncate">{user.email}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {userMenuOpen && (
              <div className="absolute bottom-full left-2 right-2 mb-1 py-1 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-50">
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  className="block w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 rounded-t-lg"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
