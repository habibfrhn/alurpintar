// src/InvoiceCollection.tsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface Invoice {
  id: string;
  fileName: string;
}

const InvoiceCollection: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvoices = async () => {
      setLoading(true);
      try {
        const response = await axios.get<Invoice[]>('/api/invoices');
        setInvoices(response.data);
      } catch (err: any) {
        setError(err.message || 'Error fetching invoices');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Invoice Collection</h1>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}
      <ul>
        {invoices.map((invoice) => (
          <li key={invoice.id} className="mb-2 p-4 border rounded">
            {invoice.fileName}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default InvoiceCollection;
