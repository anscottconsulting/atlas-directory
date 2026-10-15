import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import HierarchyPage from "./pages/HierarchyPage";
import DirectoryListPage from "./pages/DirectoryListPage";
import OrganizationDetailPage from "./pages/OrganizationDetailPage";
import OrganizationFormPage from "./pages/OrganizationFormPage";
import VerifyLayout from "./pages/verification/VerifyLayout";
import OverviewPage from "./pages/verification/OverviewPage";
import QueuePage from "./pages/verification/QueuePage";
import EntryPage from "./pages/verification/EntryPage";
import { IssuesListPage, IssueDetailPage } from "./pages/verification/IssuesPage";
import QualityPage from "./pages/verification/QualityPage";
import SubmitterPage from "./pages/verification/SubmitterPage";
import SubmitterLevel1Page from "./pages/verification/SubmitterLevel1Page";

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
        <Route path="verify" element={<VerifyLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="queue" element={<QueuePage />} />
          <Route path="entry/:id" element={<EntryPage />} />
          <Route path="issues" element={<IssuesListPage />} />
          <Route path="issues/:id" element={<IssueDetailPage />} />
          <Route path="quality" element={<QualityPage />} />
          <Route path="submitter" element={<SubmitterPage />} />
          <Route path="submitter-level-1" element={<SubmitterLevel1Page />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
