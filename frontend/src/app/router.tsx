import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { RequireAuth } from './RequireAuth';
import Login from '@/pages/Login';
import SelectWorkspace from '@/pages/SelectWorkspace';
import Campaigns from '@/pages/Campaigns';
import CreateCampaign from '@/pages/CreateCampaign';
import CampaignDetail from '@/pages/CampaignDetail';
import CampaignAnalytics from '@/pages/CampaignAnalytics';
import AgentAnalytics from '@/pages/AgentAnalytics';

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/select-workspace', element: <SelectWorkspace /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/campaigns" replace /> },
      { path: 'campaigns', element: <Campaigns /> },
      { path: 'campaigns/new', element: <CreateCampaign /> },
      { path: 'campaigns/:id', element: <CampaignDetail /> },
      { path: 'analytics/campaigns', element: <CampaignAnalytics /> },
      { path: 'analytics/agents', element: <AgentAnalytics /> },
      { path: 'analytics/agents/:callId', element: <AgentAnalytics /> },
      { path: '*', element: <Navigate to="/campaigns" replace /> },
    ],
  },
]);
