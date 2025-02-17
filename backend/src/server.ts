import express, { Request, Response } from 'express';
import multer from 'multer';
import cors from 'cors';
import Tesseract from 'tesseract.js';
import path from 'path';
import fs from 'fs';

const app = express();
app.use(cors());

// Ensure the "uploads" directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure Multer to store uploaded files in the "uploads" directory
const upload = multer({ dest: uploadsDir });

// Test endpoint to verify connectivity
app.get('/api/test', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// POST endpoint for invoice uploads
app.post('/api/upload', upload.single('invoice'), async (req: Request, res: Response): Promise<void> => {
  console.log('Received upload request.');
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  try {
    const filePath = req.file.path;

    // Run OCR on the uploaded file
    const { data: { text } } = await Tesseract.recognize(filePath, 'eng');

    // *** LOG THE RAW OCR OUTPUT ***
    console.log('=== RAW OCR TEXT START ===');
    console.log(text);
    console.log('=== RAW OCR TEXT END ===');

    // Extract invoice data using regex patterns
    const invoiceData = extractInvoiceData(text);

    // Log the extracted data too
    console.log('Extracted Invoice Data:', invoiceData);

    // Clean up the temporary file (optional but recommended)
    fs.unlinkSync(filePath);

    // Respond with the extracted data
    res.json(invoiceData);
  } catch (error) {
    console.error('Error during processing:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

/**
 * Attempts to extract:
 *  - The vendor name "East Repair Inc." 
 *  - The invoice date after the words "INVOICE DATE" 
 *  - The total amount after the word "TOTAL"
 */
function extractInvoiceData(text: string) {
  // Specifically look for "east repair inc." ignoring case
  const vendorRegex = /(east\s+repair\s+inc\.?)/i;

  // Looks for "INVOICE DATE" then a date in dd/mm/yyyy format
  const dateRegex = /(?:INVOICE\s+DATE)\s*[:\-]?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i;

  // Looks for "TOTAL $154.06"
  const amountRegex = /TOTAL\s*[:\-]?\s*\$?([\d,\.]+)/i;

  const vendorMatch = vendorRegex.exec(text);
  const dateMatch = dateRegex.exec(text);
  const amountMatch = amountRegex.exec(text);

  return {
    vendor: vendorMatch ? vendorMatch[1].trim() : 'Not found',
    date: dateMatch ? dateMatch[1].trim() : 'Not found',
    amount: amountMatch ? amountMatch[1].trim() : 'Not found',
  };
}

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
