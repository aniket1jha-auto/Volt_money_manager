import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { AuthProvider } from './hooks/useAuth';
import { WorkspaceProvider } from './hooks/useWorkspace';
import { ToastProvider } from './components/ui/Toast';
import './styles/tokens.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <AuthProvider>
        <WorkspaceProvider>
          <RouterProvider router={router} />
        </WorkspaceProvider>
      </AuthProvider>
    </ToastProvider>
  </StrictMode>,
);
