import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router";
import HomePage from "@/react-app/pages/Home";
import AnalyticsDashboard from "@/react-app/pages/AnalyticsDashboard";
import { startAutoSync } from "@/react-app/stores/appStore";

export default function App() {
  useEffect(() => startAutoSync(), []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/analytics" element={<AnalyticsDashboard />} />
      </Routes>
    </Router>
  );
}
