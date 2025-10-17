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
  private apiKey?: string;
  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.MOUSER_API_KEY;
  }
  get enabled() {
    return !!this.apiKey;
  }
  async searchKeyword(keyword: string, records = 50): Promise<MouserPart[]> {
    if (!this.enabled) return [];
    const url = `https://api.mouser.com/api/v1/search/keyword?apiKey=${encodeURIComponent(this.apiKey!)}`;
    const body = {
      SearchByKeywordRequest: {
        keyword,
        records,
        searchOptions: 'ExactAndSimilar',
        searchWithYourSignUpLanguage: false,
      },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Mouser keyword error ${res.status}`);
    const json: any = await res.json();
    return json?.SearchResults?.Parts ?? [];
  }
  async searchPartNumber(mouserPartNumber: string): Promise<MouserPart[]> {
    if (!this.enabled) return [];
    const url = `https://api.mouser.com/api/v1/search/partnumber?apiKey=${encodeURIComponent(this.apiKey!)}`;
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
    if (!res.ok) throw new Error(`Mouser part error ${res.status}`);
    const json: any = await res.json();
    return json?.SearchResults?.Parts ?? [];
  }
}

