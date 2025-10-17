import { MouserClient } from './mouser.js';

export type ToolDef = {
  name: string;
  description: string;
  parameters: any;
  handler: (args: any) => Promise<any>;
};

export function defineTools(client: MouserClient): { tools: any[]; map: Record<string, ToolDef> } {
  const defs: ToolDef[] = [
    {
      name: 'searchKeyword',
      description: 'Search parts by keyword on Mouser (max 50).',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string' },
          records: { type: 'number', minimum: 1, maximum: 50, default: 50 },
        },
        required: ['keyword'],
        additionalProperties: false,
      },
      handler: async (args: any) => {
        const items = await client.searchKeyword(String(args.keyword || ''), args.records ?? 50);
        return { parts: compactParts(items) };
      },
    },
    {
      name: 'searchPartNumber',
      description: 'Lookup a specific Mouser part number.',
      parameters: {
        type: 'object',
        properties: { mouserPartNumber: { type: 'string' } },
        required: ['mouserPartNumber'],
        additionalProperties: false,
      },
      handler: async (args: any) => {
        const items = await client.searchPartNumber(String(args.mouserPartNumber || ''));
        return { parts: compactParts(items) };
      },
    },
  ];

  const tools = defs.map((d) => ({
    type: 'function',
    function: { name: d.name, description: d.description, parameters: d.parameters },
  }));
  const map: Record<string, ToolDef> = Object.fromEntries(defs.map((d) => [d.name, d]));
  return { tools, map };
}

function compactParts(items: any[]): any[] {
  return (items || []).slice(0, 12).map((p) => ({
    manufacturer: p.Manufacturer,
    mpn: p.ManufacturerPartNumber,
    mouser: p.MouserPartNumber,
    series: p.Series,
    tol: p.Tolerance,
    power: p.PowerRating,
    caseSize: p.CaseSize,
    availability: p.Availability,
    url: p.ProductDetailUrl,
    packaging: p.Packaging,
  }));
}

