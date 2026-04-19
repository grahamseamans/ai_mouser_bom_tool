export type MouserPart = {
  Manufacturer?: string;
  ManufacturerPartNumber?: string;
  MouserPartNumber?: string;
  Description?: string;
  Availability?: string;
  LifecycleStatus?: string;
  Series?: string;
  Tolerance?: string;
  PowerRating?: string;
  CaseSize?: string;
  Packaging?: string;
  ProductDetailUrl?: string;
  PriceBreaks?: Array<{ Quantity: number; Price: string; Currency?: string }>;
  LeadTime?: string;
};

export class MouserClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.MOUSER_API_KEY;
    if (!key) throw new Error('MOUSER_API_KEY is required');
    this.apiKey = key;
  }

  async searchKeyword(keyword: string, records = 50, inStockOnly = false): Promise<MouserPart[]> {
    const url = `https://api.mouser.com/api/v1/search/keyword?apiKey=${encodeURIComponent(this.apiKey)}`;
    const body = {
      SearchByKeywordRequest: {
        keyword,
        records,
        searchOptions: inStockOnly ? 'InStock' : 'ExactAndSimilar',
        searchWithYourSignUpLanguage: false,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Mouser keyword search failed (${res.status}): ${errText}`);
    }

    const json: any = await res.json();
    return json?.SearchResults?.Parts ?? [];
  }

  async searchPartNumber(mouserPartNumber: string): Promise<MouserPart[]> {
    const url = `https://api.mouser.com/api/v1/search/partnumber?apiKey=${encodeURIComponent(this.apiKey)}`;
    const body = {
      SearchByPartRequest: {
        mouserPartNumber,
        partSearchOptions: 'None',
        mouserPaysCustomsAndDuties: false,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Mouser part number search failed (${res.status}): ${errText}`);
    }

    const json: any = await res.json();
    return json?.SearchResults?.Parts ?? [];
  }
}
