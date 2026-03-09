import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, LayoutDashboard, Briefcase, Users, BarChart3, Bell, LogOut, ChevronRight } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const CANDIDATE_LINKS = [
  { to: "/candidate", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/candidate/jobs", icon: Briefcase, label: "Browse Jobs" },
];

const ADMIN_LINKS = [
  { to: "/recruiter", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/recruiter/jobs", icon: Briefcase, label: "Job Listings" },
  { to: "/recruiter/analytics", icon: BarChart3, label: "Analytics" },
];

export default function Sidebar({ notifications = 0 }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const links = user?.role === "admin" ? ADMIN_LINKS : CANDIDATE_LINKS;

  const isActive = (to) => location.pathname === to || (to !== "/recruiter" && to !== "/candidate" && location.pathname.startsWith(to));

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-gray-100 flex flex-col fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-blue-600 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="font-display font-bold text-gray-900">TalentLens <span className="text-primary-600">AI</span></span>
      </div>

      {/* User info */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm font-display shrink-0">
            {user?.name?.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">{user?.name}</div>
            <div className="text-xs text-gray-400 capitalize">{user?.role === "admin" ? "Recruiter" : "Candidate"}</div>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map((link) => (
          <Link key={link.to} to={link.to} className={isActive(link.to) ? "sidebar-link-active" : "sidebar-link"}>
            <link.icon className="w-4 h-4 shrink-0" />
            <span>{link.label}</span>
            {isActive(link.to) && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-70" />}
          </Link>
        ))}

        <Link to="/notifications" className={`${isActive("/notifications") ? "sidebar-link-active" : "sidebar-link"} justify-between`}>
          <div className="flex items-center gap-3">
            <Bell className="w-4 h-4 shrink-0" />
            <span>Notifications</span>
          </div>
          {notifications > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{notifications}</span>
          )}
        </Link>
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-gray-100">
        <button onClick={logout}
          className="sidebar-link w-full text-red-500 hover:bg-red-50 hover:text-red-600">
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
