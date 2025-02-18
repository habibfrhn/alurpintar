// src/components/InvoiceUploader.tsx
import React, { useState, ChangeEvent } from 'react';
import axios from 'axios';
import InvoiceViewer, { InvoiceData } from './InvoiceViewer';

const InvoiceUploader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Adjust to your server's address
  const API_URL = 'http://localhost:5000';

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
    <div style={{ margin: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h2>Upload an Invoice</h2>
      <input type="file" onChange={handleFileChange} accept="image/*,.pdf" />
      <button onClick={handleUpload} disabled={loading} style={{ marginLeft: '1rem' }}>
        {loading ? 'Processing...' : 'Upload & Process'}
      </button>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {extractedData && (
        <div style={{ marginTop: '2rem' }}>
          <InvoiceViewer data={extractedData} />
        </div>
      )}
    </div>
  );
};

export default InvoiceUploader;
