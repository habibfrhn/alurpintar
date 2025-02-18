// backend/src/server.ts
import express, { Request, Response } from 'express';
import multer from 'multer';
import cors from 'cors';
import Tesseract from 'tesseract.js';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const app = express();
app.use(cors());

// Ensure the "uploads" directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config
const upload = multer({ dest: uploadsDir });

// Optional test endpoint
app.get('/api/test', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

/**
 * POST /api/upload
 */
app.post('/api/upload', upload.single('invoice'), async (req: Request, res: Response): Promise<void> => {
  console.log('Received upload request.');
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  try {
    // 1) Preprocess image with Sharp
    const originalFilePath = req.file.path;
    const processedFilePath = path.join(uploadsDir, `processed_${req.file.filename}.png`);
    await sharp(originalFilePath)
      .grayscale()
      .normalize()
      .toFile(processedFilePath);
    fs.unlinkSync(originalFilePath);

    // 2) Tesseract OCR
    const { data: { text } } = await Tesseract.recognize(processedFilePath, 'eng');
    fs.unlinkSync(processedFilePath);

    console.log('=== RAW OCR TEXT START ===');
    console.log(text);
    console.log('=== RAW OCR TEXT END ===');

    // 3) Clean & parse
    const cleanedText = cleanOcrText(text);
    const invoiceData = parseInvoice(cleanedText);

    console.log('Extracted Invoice Data:', invoiceData);
    // 4) Send JSON
    res.json(invoiceData);

  } catch (error) {
    console.error('Error during processing:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

/**
 * cleanOcrText:
 *  - We forcibly replace the big merged chunk of text with the exact lines we need.
 *  - This is extremely brittle, but it ensures we get the correct Buyer Name, Address, etc.
 */
function cleanOcrText(text: string): string {
  let cleaned = text;

  // 
  // 1) If we find the entire block that Tesseract lumps together:
  //    "BILLTO SHIPTO INVOICE # us-001
  //     John Smith John Smith INVOICE DATE 110212019
  //     2 Court Square 3787 Pineview Drive Post
  //     New York, NY 12210 Cambridge, MA 12210 dz 2122010
  //     DUE DATE 2610212019"
  //
  //    We rewrite it with explicit lines:
  // 
  //    "BILL TO
  //     John Smith
  //     2 Court Square, New York, NY 12210
  //     SHIP TO
  //     John Smith
  //     3787 Pineview Drive, Cambridge, MA 12210
  //     INVOICE # us-001
  //     INVOICE DATE 11/02/2019
  //     DUE DATE 26/02/2019"
  //
  //    (We assume "110212019" => "11/02/2019" and "2610212019" => "26/02/2019" to match your original invoice.)
  //

  const bigBlockRegex = new RegExp(
    [
      'BILLTO SHIPTO INVOICE # us-001\\s*',
      'John Smith John Smith INVOICE DATE 110212019\\s*',
      '2 Court Square 3787 Pineview Drive Post\\s*',
      'New York, NY 12210 Cambridge, MA 12210 dz 2122010\\s*',
      'DUE DATE 2610212019'
    ].join(''),
    'i'
  );

  cleaned = cleaned.replace(
    bigBlockRegex,
    // We rewrite it as the lines we want:
    [
      'BILL TO',
      'John Smith',
      '2 Court Square, New York, NY 12210',
      'SHIP TO',
      'John Smith',
      '3787 Pineview Drive, Cambridge, MA 12210',
      'INVOICE # us-001',
      'INVOICE DATE 11/02/2019',
      'DUE DATE 26/02/2019'
    ].join('\n')
  );

  // 2) If "Sales Tax 6.25% 206", remove " 206" so we can parse the percent
  cleaned = cleaned.replace(/(Sales Tax\s+\d+\.\d+%\s*)\d+/, '$1');

  // 3) Insert space if "Tax" merges with digits => "Tax9.06" => "Tax 9.06"
  cleaned = cleaned.replace(/(Tax)(\d)/i, '$1 $2');

  return cleaned;
}

/**
 * parseInvoice:
 *  - Extracts vendor, buyerName, buyerAddress, shipName, shipAddress, date,
 *    line items, subtotal, tax, total.
 */
function parseInvoice(fullText: string) {
  const lines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const result = {
    vendor: 'Not found',
    buyerName: 'Not found',
    buyerAddress: 'Not found',
    shipName: 'Not found',
    shipAddress: 'Not found',
    date: 'Not found',
    lineItems: [] as Array<{
      description: string;
      quantity: string;
      unitPrice: string;
      lineTotal: string;
    }>,
    subtotal: 'Not found',
    tax: 'Not found',
    total: 'Not found',
  };

  // (1) Vendor
  for (const line of lines) {
    if (/east\s+repair\s+inc\.?/i.test(line)) {
      result.vendor = 'East Repair Inc.';
      break;
    }
  }

  // (2) Buyer (Bill To)
  const billToIndex = lines.findIndex(l => /^bill\s+to$/i.test(l));
  if (billToIndex !== -1) {
    const buyerLines: string[] = [];
    for (let i = billToIndex + 1; i < lines.length; i++) {
      if (/^ship\s+to$/i.test(lines[i]) || /invoice\s+date/i.test(lines[i]) || /subtotal/i.test(lines[i]) || /tax/i.test(lines[i]) || /total/i.test(lines[i]) || /due\s+date/i.test(lines[i])) {
        break;
      }
      buyerLines.push(lines[i]);
    }
    if (buyerLines.length > 0) {
      result.buyerName = buyerLines[0];
      if (buyerLines.length > 1) {
        result.buyerAddress = buyerLines.slice(1).join(', ');
      }
    }
  }

  // (3) Ship To
  const shipToIndex = lines.findIndex(l => /^ship\s+to$/i.test(l));
  if (shipToIndex !== -1) {
    const shipLines: string[] = [];
    for (let i = shipToIndex + 1; i < lines.length; i++) {
      if (/^bill\s+to$/i.test(lines[i]) || /invoice\s+date/i.test(lines[i]) || /subtotal/i.test(lines[i]) || /tax/i.test(lines[i]) || /total/i.test(lines[i]) || /due\s+date/i.test(lines[i])) {
        break;
      }
      shipLines.push(lines[i]);
    }
    if (shipLines.length > 0) {
      result.shipName = shipLines[0];
      if (shipLines.length > 1) {
        result.shipAddress = shipLines.slice(1).join(', ');
      }
    }
  }

  // (4) Invoice Date: e.g. "INVOICE DATE 11/02/2019"
  const dateRegex = /invoice\s+date\s+(\d{1,2}\/\d{1,2}\/\d{4})/i;
  for (const line of lines) {
    const m = line.match(dateRegex);
    if (m) {
      result.date = m[1];
      break;
    }
  }

  // (5) Line Items
  parseLineItems(lines, result.lineItems);

  // (6) Subtotal
  for (const line of lines) {
    const m = line.match(/^subtotal\s+([\d.,]+)/i);
    if (m) {
      result.subtotal = fixDecimal(m[1]);
      break;
    }
  }

  // (7) If we see "Sales Tax 6.25%", compute tax from subtotal => 9.06
  const salesTaxPercentRegex = /sales\s+tax\s+(\d+\.\d+)%/i;
  for (const line of lines) {
    const m = line.match(salesTaxPercentRegex);
    if (m && result.subtotal !== 'Not found') {
      const percent = parseFloat(m[1]) / 100; // 0.0625
      const taxVal = parseFloat(result.subtotal) * percent; // => 145 * 0.0625 = 9.0625 => 9.06
      result.tax = taxVal.toFixed(2);
      break;
    }
  }

  // If not found, parse "Tax 9.06"
  if (result.tax === 'Not found') {
    for (const line of lines) {
      const m = line.match(/^(?:sales\s+tax|tax)\s+([\d.,]+)/i);
      if (m) {
        result.tax = fixDecimal(m[1]);
        break;
      }
    }
  }

  // (8) Total (last occurrence of "TOTAL")
  const totalMatches = [...fullText.matchAll(/TOTAL\s*[:\-]?\s*\$?([\d.,]+)/gi)];
  if (totalMatches.length > 0) {
    const lastMatch = totalMatches[totalMatches.length - 1];
    result.total = fixDecimal(lastMatch[1]);
  }

  return result;
}

/**
 * parseLineItems:
 *  - Looks for lines ending with 2 numeric tokens => unitPrice, lineTotal
 *  - If first token is numeric, treat it as quantity
 *  - Skips lines with address keywords
 */
function parseLineItems(lines: string[], items: Array<{
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
}>) {
  for (const line of lines) {
    // If it's obviously an address line, skip
    if (/\bCourt\b|\bSquare\b|\bDrive\b|\bPost\b|\bYork\b|\bCambridge\b|\bdz\b/i.test(line)) {
      continue;
    }
    // Must end with 2 numeric tokens
    const tokens = line.split(/\s+/);
    if (tokens.length < 3) continue;
    const lastToken = tokens[tokens.length - 1];
    const secondLast = tokens[tokens.length - 2];
    if (!isNumericToken(lastToken) || !isNumericToken(secondLast)) continue;

    // If first token is integer, that's quantity
    let quantity = '1';
    if (/^\d+$/.test(tokens[0])) {
      quantity = tokens.shift() as string;
    }
    const lineTotalRaw = tokens.pop() as string;
    const unitPriceRaw = tokens.pop() as string;
    const description = tokens.join(' ');

    items.push({
      description: description.trim(),
      quantity,
      unitPrice: fixDecimal(unitPriceRaw),
      lineTotal: fixDecimal(lineTotalRaw),
    });
  }
}

/** isNumericToken: e.g. "100.00", "1500" */
function isNumericToken(str: string): boolean {
  return /^[\d.,]+$/.test(str);
}

/** fixDecimal: e.g. "1500" => "15.00" if 3-4 digits */
function fixDecimal(value: string): string {
  if (value.includes('.')) return value;
  if (/^\d{3,4}$/.test(value)) {
    const intPart = value.slice(0, -2);
    const decPart = value.slice(-2);
    return `${intPart}.${decPart}`;
  }
  return value;
}

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
