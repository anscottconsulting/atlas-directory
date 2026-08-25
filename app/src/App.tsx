import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import HierarchyPage from "./pages/HierarchyPage";
import DirectoryListPage from "./pages/DirectoryListPage";
import OrganizationDetailPage from "./pages/OrganizationDetailPage";
import OrganizationFormPage from "./pages/OrganizationFormPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="hierarchy" element={<HierarchyPage />} />
        <Route path="directory" element={<DirectoryListPage />} />
        <Route path="organization/new" element={<OrganizationFormPage />} />
        <Route
          path="organization/:id"
          element={<OrganizationDetailPage />}
        />
        <Route
          path="organization/:id/edit"
          element={<OrganizationFormPage />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
