// src/App.tsx
import React from 'react';
import InvoiceUploader from './InvoiceUploader';

const App: React.FC = () => {
  return (
    <div>
      <h1>Invoice &amp; Expense Processing</h1>
      <InvoiceUploader />
    </div>
  );
};

export default App;
