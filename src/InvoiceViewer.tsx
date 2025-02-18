// src/components/InvoiceViewer.tsx
import React from 'react';

interface LineItem {
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
}

export interface InvoiceData {
  vendor: string;
  buyerName: string;
  buyerAddress: string;
  date: string;
  subtotal: string;
  tax: string;
  total: string;
  lineItems: LineItem[];
}

interface InvoiceViewerProps {
  data: InvoiceData;
}

const InvoiceViewer: React.FC<InvoiceViewerProps> = ({ data }) => {
  if (!data) {
    return <div>No invoice data to display.</div>;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>Invoice & Expense Processing</h1>

      {/* Seller / Vendor Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ width: '48%', background: '#f9f9f9', padding: '10px', borderRadius: '5px' }}>
          <h2 style={{ fontWeight: 'bold', marginBottom: '10px', textTransform: 'uppercase', color: '#555' }}>
            Seller (Vendor)
          </h2>
          <p><strong>Company Name:</strong> {data.vendor}</p>
        </div>

        <div style={{ width: '48%', background: '#f9f9f9', padding: '10px', borderRadius: '5px' }}>
          <h2 style={{ fontWeight: 'bold', marginBottom: '10px', textTransform: 'uppercase', color: '#555' }}>
            Buyer (Bill To)
          </h2>
          <p><strong>Name:</strong> {data.buyerName}</p>
          <p><strong>Address:</strong> {data.buyerAddress}</p>
        </div>
      </div>

      {/* Invoice Details */}
      <div style={{ marginBottom: '20px', background: '#f9f9f9', padding: '10px', borderRadius: '5px' }}>
        <h2 style={{ fontWeight: 'bold', marginBottom: '10px', textTransform: 'uppercase', color: '#555' }}>
          Invoice Details
        </h2>
        <p><strong>Invoice Date:</strong> {data.date}</p>
      </div>

      {/* Line Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
        <thead style={{ background: '#eee' }}>
          <tr>
            <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Description</th>
            <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Quantity</th>
            <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Unit Price</th>
            <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Line Total</th>
          </tr>
        </thead>
        <tbody>
          {data.lineItems.map((item, index) => (
            <tr key={index}>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>{item.description}</td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>{item.quantity}</td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>{item.unitPrice}</td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>{item.lineTotal}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ textAlign: 'right', marginTop: '10px' }}>
        <div><strong>Subtotal:</strong> {data.subtotal}</div>
        <div><strong>Tax:</strong> {data.tax}</div>
        <div><strong>Total:</strong> {data.total}</div>
      </div>

      {/* Payment Terms, Signature, etc. */}
      <div style={{ marginTop: '20px', background: '#f9f9f9', padding: '10px', borderRadius: '5px' }}>
        <p><strong>Payment Terms:</strong> Payment is due within 15 days.</p>
        <p><strong>Signature:</strong> John Smith</p>
      </div>
    </div>
  );
};

export default InvoiceViewer;
