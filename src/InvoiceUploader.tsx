// src/components/InvoiceUploader.tsx
import React, { useState, ChangeEvent } from 'react';
import axios from 'axios';

interface InvoiceData {
  vendor: string;
  amount: string;
  date: string;
}

const InvoiceUploader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Adjust to your server's address. If running on the same machine, "http://localhost:5000" often works.
  const API_URL = process.env.REACT_APP_API_URL || 'http://192.168.0.105:5000';

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('invoice', file);

    try {
      const res = await axios.post<InvoiceData>(`${API_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setExtractedData(res.data);
    } catch (err: any) {
      console.error(err);
      const message = err.response?.data?.error || err.message || 'Error uploading file. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ margin: '2rem' }}>
      <h2>Upload an Invoice</h2>
      <input type="file" onChange={handleFileChange} accept="image/*,.pdf" />
      <button onClick={handleUpload} disabled={loading}>
        {loading ? 'Processing...' : 'Upload & Process'}
      </button>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {extractedData && (
        <div>
          <h3>Extracted Invoice Data:</h3>
          <p><strong>Vendor:</strong> {extractedData.vendor}</p>
          <p><strong>Date:</strong> {extractedData.date}</p>
          <p><strong>Amount:</strong> {extractedData.amount}</p>
          <pre style={{ backgroundColor: '#f4f4f4', padding: '1rem' }}>
            {JSON.stringify(extractedData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default InvoiceUploader;
