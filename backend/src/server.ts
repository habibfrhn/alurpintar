// backend/src/server.ts
import 'dotenv/config';
import express, { Request, Response } from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import {
  TextractClient,
  AnalyzeDocumentCommand,
  FeatureType,
  AnalyzeDocumentCommandOutput,
  Block,
} from '@aws-sdk/client-textract';

const app = express();
app.use(cors());
app.use(express.json());

// Ensure the "uploads" directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files from the uploads folder
app.use('/uploads', express.static(uploadsDir));

// Configure Multer to store uploaded files in the "uploads" directory
const upload = multer({ dest: uploadsDir });

// Initialize Textract client using environment variables
const textractClient = new TextractClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// In-memory "databank" for invoices
interface Invoice {
  id: string;
  fileName: string;
  filePath: string;
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
let invoices: Invoice[] = [];

// Test endpoint
app.get('/api/test', (req: Request, res: Response): void => {
  res.json({ status: 'ok' });
});

/**
 * POST /api/upload
 * Uploads an invoice, sends it to Amazon Textract for analysis,
 * and returns:
 *   - lines[] (raw lines of text)
 *   - keyValue{} (parsed key-value pairs)
 *   - fileUrl (URL for the uploaded image/PDF)
 */
app.post(
  '/api/upload',
  upload.single('invoice'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      console.log('Received /api/upload request.');
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }
      const filePath = req.file.path;
      const fileBytes = fs.readFileSync(filePath);

      const params = {
        Document: { Bytes: fileBytes },
        FeatureTypes: [FeatureType.FORMS, FeatureType.TABLES],
      };

      const command = new AnalyzeDocumentCommand(params);
      const response = await textractClient.send(command);

      const PORT = process.env.PORT || 5000;
      const fileUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;

      // 1) Extract raw lines
      const linesArray = extractLinesFromAnalyzeDocument(response);

      // 2) Extract key-value pairs
      const keyValuePairs = extractKeyValuePairsFromAnalyzeDocument(response);

      // Log them in the server console for debugging
      console.log('Extracted lines:', linesArray);
      console.log('Extracted key-value pairs:', keyValuePairs);

      res.json({ lines: linesArray, keyValue: keyValuePairs, fileUrl });
    } catch (error) {
      console.error('Error during processing:', error);
      res.status(500).json({ error: 'Processing failed' });
    }
  }
);

/**
 * Helper function to extract lines from the Textract response.
 */
function extractLinesFromAnalyzeDocument(
  response: AnalyzeDocumentCommandOutput
): string[] {
  if (!response || !response.Blocks) return [];
  const lines: string[] = [];
  for (const block of response.Blocks) {
    if (block.BlockType === 'LINE' && block.Text) {
      lines.push(block.Text);
    }
  }
  return lines;
}

/**
 * Helper function to extract key-value pairs from the Textract response.
 */
function extractKeyValuePairsFromAnalyzeDocument(
  response: AnalyzeDocumentCommandOutput
): Record<string, string> {
  if (!response || !response.Blocks) return {};

  const blocks = response.Blocks;
  // Create a map of blockId -> block
  const blockMap = new Map<string, Block>();
  for (const b of blocks) {
    if (b.Id) {
      blockMap.set(b.Id, b);
    }
  }

  const keyValue: Record<string, string> = {};

  for (const block of blocks) {
    // Check if block is a KEY and has relationships
    if (
      block.BlockType === 'KEY_VALUE_SET' &&
      block.EntityTypes?.includes('KEY') &&
      block.Relationships
    ) {
      let keyText = '';
      let valueText = '';

      // 1) Extract key text from child relationships
      const childRel = block.Relationships.find((r) => r.Type === 'CHILD');
      if (childRel?.Ids) {
        for (const cid of childRel.Ids) {
          const childBlock = blockMap.get(cid);
          if (childBlock?.Text) {
            keyText += childBlock.Text + ' ';
          }
        }
        keyText = keyText.trim();
      }

      // 2) Find VALUE block
      const valueRel = block.Relationships.find((r) => r.Type === 'VALUE');
      if (valueRel?.Ids && valueRel.Ids.length > 0) {
        const valueBlock = blockMap.get(valueRel.Ids[0]);
        if (valueBlock?.BlockType === 'KEY_VALUE_SET' && valueBlock.Relationships) {
          // 3) Extract the text from the child blocks of the VALUE block
          const valChildRel = valueBlock.Relationships.find((r) => r.Type === 'CHILD');
          if (valChildRel?.Ids) {
            for (const vcid of valChildRel.Ids) {
              const vchildBlock = blockMap.get(vcid);
              if (vchildBlock?.Text) {
                valueText += vchildBlock.Text + ' ';
              }
            }
            valueText = valueText.trim();
          }
        }
      }

      if (keyText) {
        keyValue[keyText] = valueText;
      }
    }
  }
  return keyValue;
}

/**
 * POST /api/invoices
 * Saves an invoice into the databank.
 * If a file is uploaded, use it; otherwise, assume JSON data (from InvoiceProcesser).
 */
app.post(
  '/api/invoices',
  upload.single('invoice'),
  (req: Request, res: Response): void => {
    try {
      if (req.file) {
        // File upload case (if needed)
        const invoiceId = Date.now().toString();
        const filePath = req.file.path;
        const fileName = req.file.originalname;
        const PORT = process.env.PORT || 5000;
        const invoice: Invoice = {
          id: invoiceId,
          fileName,
          filePath,
          imageUrl: `http://localhost:${PORT}/uploads/${req.file.filename}`,
          sellerName: '',
          buyerName: '',
          buyerAddress: '',
          transactionNumber: '',
          invoiceDate: '',
          dueDate: '',
          taxAmount: '',
          amountPaid: '',
        };
        invoices.push(invoice);
        res.json({ id: invoiceId });
      } else {
        // Processed invoice saved from InvoiceProcesser (sent as JSON)
        const invoiceData = req.body as Invoice;
        const invoiceId = Date.now().toString();
        invoiceData.id = invoiceId;
        invoices.push(invoiceData);
        res.json({ id: invoiceId });
      }
    } catch (error) {
      res.status(500).json({ error: 'Error saving invoice' });
    }
  }
);

/**
 * GET /api/invoices
 * Returns a list of all uploaded invoices.
 */
app.get('/api/invoices', (req: Request, res: Response): void => {
  res.json(invoices);
});

/**
 * GET /api/invoices/:id
 * Returns details for a specific invoice.
 */
app.get('/api/invoices/:id', (req: Request, res: Response): void => {
  const invoice = invoices.find((inv) => inv.id === req.params.id);
  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }
  res.json(invoice);
});

/**
 * PUT /api/invoices/:id
 * Updates details of a specific invoice.
 */
app.put('/api/invoices/:id', (req: Request, res: Response): void => {
  const invoice = invoices.find((inv) => inv.id === req.params.id);
  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }
  Object.assign(invoice, req.body);
  res.json({ message: 'Invoice updated successfully' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, (): void => {
  console.log(`Server running on port ${PORT}`);
});
