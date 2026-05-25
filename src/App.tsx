import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import AddLead from './pages/AddLead';
import EditLead from './pages/EditLead';
import LeadDetail from './pages/LeadDetail';
import BottleneckAudit from './pages/BottleneckAudit';
import EmailDrafts from './pages/EmailDrafts';
import CRMPipeline from './pages/CRMPipeline';
import FollowUps from './pages/FollowUps';
import Trials from './pages/Trials';
import SettingsPage from './pages/Settings';
import ComplianceCenter from './pages/ComplianceCenter';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/leads/new" element={<AddLead />} />
        <Route path="/leads/:id/edit" element={<EditLead />} />
        <Route path="/leads/:id" element={<LeadDetail />} />
        <Route path="/audit" element={<BottleneckAudit />} />
        <Route path="/audit/:leadId" element={<BottleneckAudit />} />
        <Route path="/emails" element={<EmailDrafts />} />
        <Route path="/emails/:leadId" element={<EmailDrafts />} />
        <Route path="/pipeline" element={<CRMPipeline />} />
        <Route path="/followups" element={<FollowUps />} />
        <Route path="/trials" element={<Trials />} />
        <Route path="/compliance" element={<ComplianceCenter />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
}
