import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { RequireAuth } from './RequireAuth';
import Login from '@/pages/Login';
import SelectWorkspace from '@/pages/SelectWorkspace';
import Campaigns from '@/pages/Campaigns';
import CreateCampaign from '@/pages/CreateCampaign';
import CampaignDetail from '@/pages/CampaignDetail';
import Audiences from '@/pages/Audiences';
import Analytics from '@/pages/Analytics';

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
      { path: 'audiences', element: <Audiences /> },
      { path: 'analytics', element: <Analytics /> },
      { path: 'analytics/calls/:callId', element: <Analytics /> },
      // Back-compat redirects from the older split-analytics URLs.
      { path: 'analytics/campaigns', element: <Navigate to="/analytics" replace /> },
      { path: 'analytics/agents', element: <Navigate to="/analytics" replace /> },
      { path: 'analytics/agents/:callId', element: <Navigate to="/analytics" replace /> },
      { path: '*', element: <Navigate to="/campaigns" replace /> },
    ],
  },
]);
