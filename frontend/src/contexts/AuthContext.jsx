import { createContext, useContext, useState } from "react";
import { authAPI } from "../api/client";

const AuthContext = createContext(null);

// ── Use sessionStorage so each browser tab has its own independent session.
// This allows Tab A to be logged in as admin and Tab B as candidate simultaneously.
const storage = sessionStorage;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(storage.getItem("user")); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    storage.setItem("token", data.access_token);
    storage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const register = async (name, email, password, role = "candidate") => {
    const { data } = await authAPI.register({ name, email, password, role });
    storage.setItem("token", data.access_token);
    storage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    storage.removeItem("token");
    storage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
