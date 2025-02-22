// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import InvoiceCollection from './InvoiceCollection';
import InvoiceUploader from './InvoiceUploader';
import InvoiceProcesser from './InvoiceProcesser';
import theme from './theme';

const App: React.FC = () => {
  return (
    <Router>
      <div
        className="flex h-screen"
        style={{ backgroundColor: theme.secondary }}
      >
        {/* Sidebar */}
        <aside
          className="w-64 p-4 text-white flex flex-col"
          style={{ backgroundColor: theme.primary }}
        >
          <h1 className="text-xl font-bold mb-6">Alur Pintar</h1>
          <nav className="space-y-2 flex-grow">
            <Link
              to="/"
              className="block px-3 py-2 rounded hover:bg-black/10"
            >
              Beranda
            </Link>
            <Link
              to="/upload"
              className="block px-3 py-2 rounded hover:bg-black/10"
            >
              Upload Faktur
            </Link>
          </nav>
        </aside>

        {/* Main content area */}
        <main
          className="flex-1 overflow-auto p-6"
          style={{ backgroundColor: theme.background }}
        >
          <Routes>
            <Route path="/" element={<InvoiceCollection />} />
            <Route path="/upload" element={<InvoiceUploader />} />
            <Route path="/process" element={<InvoiceProcesser />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
