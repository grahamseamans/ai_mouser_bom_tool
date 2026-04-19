import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { MouserClient, type MouserPart } from './mouser.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(import.meta.dirname, '..', '.env') });

const SEARCHES_DIR = path.resolve(import.meta.dirname, '..', 'searches');

const client = new MouserClient();

// Ensure searches directory exists
await fs.mkdir(SEARCHES_DIR, { recursive: true });

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9_\-. ]/g, '_').replace(/\s+/g, '_').slice(0, 80);
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function writeSearchResults(label: string, parts: MouserPart[]): Promise<string> {
  const filename = `${sanitizeFilename(label)}_${timestamp()}.json`;
  const filepath = path.join(SEARCHES_DIR, filename);

  const compact = parts.map((p) => ({
    manufacturer: p.Manufacturer,
    mpn: p.ManufacturerPartNumber,
    mouserPN: p.MouserPartNumber,
    description: p.Description,
    series: p.Series,
    tolerance: p.Tolerance,
    power: p.PowerRating,
    caseSize: p.CaseSize,
    availability: p.Availability,
    priceBreaks: p.PriceBreaks,
    leadTime: p.LeadTime,
    lifecycle: p.LifecycleStatus,
    packaging: p.Packaging,
    url: p.ProductDetailUrl,
  }));

  await fs.writeFile(filepath, JSON.stringify(compact, null, 2));
  return filepath;
}

function summarizeParts(parts: MouserPart[], limit = 5): string {
  if (parts.length === 0) return 'No results found.';

  const lines = parts.slice(0, limit).map((p, i) => {
    const price = p.PriceBreaks?.[0]?.Price ?? '?';
    return `${i + 1}. ${p.Manufacturer} ${p.ManufacturerPartNumber} — ${p.Description} — ${price} (${p.Availability})`;
  });

  return lines.join('\n');
}

// --- MCP Server ---

const server = new McpServer({
  name: 'mouser',
  version: '0.1.0',
});

server.tool(
  'search_keyword',
  'Search Mouser for parts by keyword. Results are saved to a file — read it for full details.',
  {
    keyword: z.string().describe('Search terms (e.g. "100nf 0805 capacitor X7R")'),
    records: z.number().min(1).max(50).default(50).describe('Max results to return (1-50)'),
    inStockOnly: z.boolean().default(false).describe('Only return in-stock parts'),
  },
  async ({ keyword, records, inStockOnly }: { keyword: string; records: number; inStockOnly: boolean }) => {
    const parts = await client.searchKeyword(keyword, records, inStockOnly);
    const filepath = await writeSearchResults(keyword, parts);

    const summary = [
      `Found ${parts.length} results for "${keyword}"${inStockOnly ? ' (in-stock only)' : ''}.`,
      `Full results: ${filepath}`,
      '',
      summarizeParts(parts),
    ].join('\n');

    return { content: [{ type: 'text', text: summary }] };
  }
);

server.tool(
  'search_part_number',
  'Look up a specific part number on Mouser. Results are saved to a file — read it for full details.',
  {
    partNumber: z.string().describe('Mouser or manufacturer part number'),
  },
  async ({ partNumber }: { partNumber: string }) => {
    const parts = await client.searchPartNumber(partNumber);
    const filepath = await writeSearchResults(partNumber, parts);

    const summary = [
      `Found ${parts.length} results for part "${partNumber}".`,
      `Full results: ${filepath}`,
      '',
      summarizeParts(parts),
    ].join('\n');

    return { content: [{ type: 'text', text: summary }] };
  }
);

// --- Start ---

const transport = new StdioServerTransport();
await server.connect(transport);
