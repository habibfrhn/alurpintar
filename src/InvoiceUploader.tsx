// src/InvoiceUploader.tsx
import React, { useState, ChangeEvent } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import theme from './theme';

const InvoiceUploader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

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
      // Call /api/upload to process with Textract
      const res = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // We now have { lines, keyValue, fileUrl }
      const { lines, keyValue, fileUrl } = res.data;
      
      // Log for debugging
      console.log('Textract lines:', lines);
      console.log('Textract keyValue:', keyValue);

      // Pass them to the next screen
      navigate('/process', { state: { extraction: lines, fileUrl, keyValue } });
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Error uploading file.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4">Upload Faktur</h2>
      <input
        type="file"
        onChange={handleFileChange}
        accept="image/jpeg, image/png, image/tiff, application/pdf"
        className="mb-4 block"
      />
      <button
        onClick={handleUpload}
        disabled={loading}
        className="px-4 py-2 rounded text-white"
        style={{ backgroundColor: theme.button }}
      >
        {loading ? 'Processing...' : 'Upload & Process'}
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
};

export default InvoiceUploader;
