import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import DocumentManager from './components/DocumentManager';
import './index.css';

// Mount the React app inside the section-documents container
const rootElement = document.getElementById('react-documents-root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <DocumentManager />
    </StrictMode>
  );
} else {
  console.error("react-documents-root element not found in the DOM.");
}
