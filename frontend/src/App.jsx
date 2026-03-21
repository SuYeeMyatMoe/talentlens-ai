import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import CandidateDashboard from "./pages/CandidateDashboard";
import RecruiterDashboard from "./pages/RecruiterDashboard";
import JobDetail from "./pages/JobDetail";
import CandidateRanking from "./pages/CandidateRanking";
import CandidateDetail from "./pages/CandidateDetail";
import CreateJob from "./pages/CreateJob";

function ProtectedRoute({ children, role }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={user ? <Navigate to={user.role === "admin" ? "/recruiter" : "/candidate"} replace /> : <Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/candidate" element={<ProtectedRoute role="candidate"><CandidateDashboard /></ProtectedRoute>} />
      <Route path="/candidate/jobs" element={<ProtectedRoute role="candidate"><CandidateDashboard /></ProtectedRoute>} />
      <Route path="/candidate/job/:jobId" element={<ProtectedRoute role="candidate"><JobDetail /></ProtectedRoute>} />
      <Route path="/candidate/application/:appId" element={<ProtectedRoute role="candidate"><CandidateDetail /></ProtectedRoute>} />

      <Route path="/recruiter" element={<ProtectedRoute role="admin"><RecruiterDashboard /></ProtectedRoute>} />
      <Route path="/recruiter/jobs" element={<ProtectedRoute role="admin"><RecruiterDashboard /></ProtectedRoute>} />
      <Route path="/recruiter/analytics" element={<ProtectedRoute role="admin"><RecruiterDashboard /></ProtectedRoute>} />
      <Route path="/recruiter/jobs/create" element={<ProtectedRoute role="admin"><CreateJob /></ProtectedRoute>} />
      <Route path="/recruiter/jobs/:jobId/candidates" element={<ProtectedRoute role="admin"><CandidateRanking /></ProtectedRoute>} />
      <Route path="/recruiter/application/:appId" element={<ProtectedRoute role="admin"><CandidateDetail /></ProtectedRoute>} />

      <Route path="/notifications" element={
        <ProtectedRoute>
          {user?.role === "admin" ? <RecruiterDashboard /> : <CandidateDashboard />}
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
