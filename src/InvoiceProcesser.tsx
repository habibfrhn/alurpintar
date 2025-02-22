// src/InvoiceProcesser.tsx
import React, { useState, useEffect, ChangeEvent } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';

export interface InvoiceDetails {
  id: string;
  fileName: string;
  imageUrl: string;
  sellerName: string;
  buyerName: string;
  buyerAddress: string;
  transactionNumber: string;
  invoiceDate: string;
  dueDate: string;
  taxAmount: string;
  amountPaid: string;
}

function parseKeyValueToInvoice(
  kv: Record<string, string>
): Omit<InvoiceDetails, 'id' | 'fileName' | 'imageUrl'> {
  // Adjust to match your actual Textract keys
  let sellerName = '';
  let buyerName = '';
  let buyerAddress = '';
  let transactionNumber = '';
  let invoiceDate = '';
  let dueDate = '';
  let taxAmount = '';
  let amountPaid = '';

  if (kv['East Repair Inc.']) {
    // This indicates the seller's name is "East Repair Inc."
    // The value is the address, e.g. "1912 Harvest Lane New York, NY 12210"
    sellerName = 'East Repair Inc.';
    // If you want to store that address somewhere:
    // buyerAddress = kv['East Repair Inc.'];
  }

  if (kv['BILL TO']) {
    // Entire string "John Smith 2 Court Square New York, NY 12210"
    // We'll store it in buyerName for now. 
    buyerName = kv['BILL TO'];
  }

  if (kv['INVOICE #']) {
    transactionNumber = kv['INVOICE #'];
  }

  if (kv['INVOICE DATE']) {
    invoiceDate = kv['INVOICE DATE'];
  }

  if (kv['DUE DATE']) {
    dueDate = kv['DUE DATE'];
  }

  // '6.25%': '9.06' => interpret as tax
  if (kv['6.25%']) {
    taxAmount = kv['6.25%'];
  }

  // 'TOTAL': '$154.06'
  if (kv['TOTAL']) {
    amountPaid = kv['TOTAL'];
  }

  return {
    sellerName,
    buyerName,
    buyerAddress,
    transactionNumber,
    invoiceDate,
    dueDate,
    taxAmount,
    amountPaid,
  };
}

const InvoiceProcesser: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const stateData = location.state as {
    extraction?: string[];
    fileUrl?: string;
    keyValue?: Record<string, string>;
  } | undefined;

  const invoiceId = new URLSearchParams(location.search).get('id');

  function buildInitialInvoice(): InvoiceDetails {
    if (stateData?.keyValue) {
      console.log('keyValue in InvoiceProcesser:', stateData.keyValue);
      const partial = parseKeyValueToInvoice(stateData.keyValue);
      return {
        id: '',
        fileName: '',
        imageUrl: stateData.fileUrl || '',
        ...partial,
      };
    } else if (stateData?.extraction) {
      // fallback line-based approach
      const lines = stateData.extraction;
      return {
        id: '',
        fileName: '',
        imageUrl: stateData.fileUrl || '',
        sellerName: lines[0] || '',
        buyerName: lines[1] || '',
        buyerAddress: lines[2] || '',
        transactionNumber: lines[3] || '',
        invoiceDate: lines[4] || '',
        dueDate: lines[5] || '',
        taxAmount: lines[6] || '',
        amountPaid: lines[7] || '',
      };
    }
    // No data
    return {
      id: '',
      fileName: '',
      imageUrl: '',
      sellerName: '',
      buyerName: '',
      buyerAddress: '',
      transactionNumber: '',
      invoiceDate: '',
      dueDate: '',
      taxAmount: '',
      amountPaid: '',
    };
  }

  const [invoice, setInvoice] = useState<InvoiceDetails | null>(
    stateData ? buildInitialInvoice() : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If we only have an id in the URL (and no stateData), fetch from server
  useEffect(() => {
    if (!stateData && invoiceId) {
      const fetchInvoice = async () => {
        setLoading(true);
        try {
          const res = await axios.get<InvoiceDetails>(`/api/invoices/${invoiceId}`);
          setInvoice(res.data);
        } catch (err: any) {
          setError(err.message || 'Error fetching invoice details');
        } finally {
          setLoading(false);
        }
      };
      fetchInvoice();
    }
  }, [invoiceId, stateData]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (invoice) {
      const { name, value } = e.target;
      setInvoice({ ...invoice, [name]: value });
    }
  };

  const handleSave = async () => {
    if (!invoice) return;
    try {
      // If the invoice has an id, update via PUT; otherwise, create via POST.
      if (invoice.id) {
        await axios.put(`/api/invoices/${invoice.id}`, invoice);
      } else {
        const res = await axios.post('/api/invoices', invoice);
        setInvoice({ ...invoice, id: res.data.id });
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Error saving invoice data');
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!invoice) return <p>No invoice found.</p>;

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Left: Invoice Image */}
      <div className="md:w-1/2">
        {invoice.imageUrl ? (
          <img
            src={invoice.imageUrl}
            alt="Invoice"
            className="w-full h-auto border rounded"
          />
        ) : (
          <p>No image available.</p>
        )}
      </div>

      {/* Right: Invoice Data Editor */}
      <div className="md:w-1/2 bg-gray-50 p-6 rounded shadow">
        <h2 className="text-2xl font-bold mb-6">Edit Invoice Data</h2>

        <div className="mb-4">
          <label className="block font-semibold mb-1">Nama perusahaan penjual</label>
          <input
            type="text"
            name="sellerName"
            value={invoice.sellerName}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>
        <div className="mb-4">
          <label className="block font-semibold mb-1">Nama pembeli</label>
          <input
            type="text"
            name="buyerName"
            value={invoice.buyerName}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>
        <div className="mb-4">
          <label className="block font-semibold mb-1">Alamat pembeli</label>
          <input
            type="text"
            name="buyerAddress"
            value={invoice.buyerAddress}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>
        <div className="mb-4">
          <label className="block font-semibold mb-1">Nomor transaksi</label>
          <input
            type="text"
            name="transactionNumber"
            value={invoice.transactionNumber}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>
        <div className="mb-4">
          <label className="block font-semibold mb-1">Tanggal faktur</label>
          <input
            type="date"
            name="invoiceDate"
            value={invoice.invoiceDate}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>
        <div className="mb-4">
          <label className="block font-semibold mb-1">Tanggal jatuh tempo faktur</label>
          <input
            type="date"
            name="dueDate"
            value={invoice.dueDate}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>
        <div className="mb-4">
          <label className="block font-semibold mb-1">Nominal pajak</label>
          <input
            type="text"
            name="taxAmount"
            value={invoice.taxAmount}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>
        <div className="mb-6">
          <label className="block font-semibold mb-1">Nominal yang dibayar</label>
          <input
            type="text"
            name="amountPaid"
            value={invoice.amountPaid}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>

        <button
          onClick={handleSave}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Save Invoice
        </button>
      </div>
    </div>
  );
};

export default InvoiceProcesser;
