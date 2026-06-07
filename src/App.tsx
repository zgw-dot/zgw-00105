import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import DashboardPage from "@/pages/DashboardPage";
import ImportPage from "@/pages/ImportPage";
import MappingPage from "@/pages/MappingPage";
import RulesPage from "@/pages/RulesPage";
import HistoryPage from "@/pages/HistoryPage";
import ExportPage from "@/pages/ExportPage";
import Notification from "@/components/common/Notification";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import { useAppStore } from "@/store";

export default function App() {
  const { loading, notification, clearNotification } = useAppStore();

  return (
    <Router>
      <MainLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/mapping" element={<MappingPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
      
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={clearNotification}
        />
      )}
      
      {loading && <LoadingOverlay />}
    </Router>
  );
}
