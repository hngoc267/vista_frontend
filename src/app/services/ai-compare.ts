import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, from } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';


export interface AiProductResult {
  name: string;
  variant_id: string;
  match_score: number;
  pros: string[];
  cons: string[];
  who_should_buy: string;
}

export interface AiResult {
  recommendation: string;
  confidence: number;
  criteria_used: string[];
  summary: string;
  products: AiProductResult[];
}

export interface AiCriterion {
  key: string;
  label: string;
  weight: number;
  enabled: boolean;
}


export interface AiSavedProduct {
  Product_name: string;
  Category_id: string;
  Images: string[];
  Discount: number;
  min_price: number;

  price: number;
  selectedVariantId: string | null;
  selectedVariant: { Price: number; Variant_name: string; Product_variant_id?: string } | null;
}

export interface AiHistoryItem {
  id: string;
  timestamp: number;
  productNames: string[];
  categoryName: string;
  criteria: AiCriterion[];
  result: AiResult;
  savedProducts?: AiSavedProduct[]; 
}

interface CriterionScoringMeta {
  specPath: string;
  direction: 'higher_better' | 'lower_better';
  extractPattern?: RegExp; 
}

const SCORING_META: Record<string, Record<string, CriterionScoringMeta>> = {

  CAT_001: {
    performance: { specPath: 'CPU', direction: 'higher_better', extractPattern: /(\d+)\s*-?core/i },
    price:       { specPath: 'price', direction: 'lower_better' },
    design:      { specPath: 'Weight', direction: 'lower_better', extractPattern: /([\d.]+)\s*kg/i },
    battery:     { specPath: 'Battery', direction: 'higher_better', extractPattern: /~?\s*(\d+)\s*giờ/i },
    brand:       { specPath: 'Performance_Level', direction: 'higher_better' }, // xử lý riêng (text scale), xem note bên dưới
  },

  CAT_002: {
    performance: { specPath: 'Performance_Level', direction: 'higher_better' },
    camera:      { specPath: 'Camera', direction: 'higher_better', extractPattern: /(\d+)\s*MP/i },
    battery:     { specPath: 'Battery', direction: 'higher_better', extractPattern: /(\d+)\s*mAh/i },
    price:       { specPath: 'price', direction: 'lower_better' },
    design:      { specPath: 'Portability', direction: 'higher_better' },
  },

  CAT_003: {
    display:     { specPath: 'Display_Size', direction: 'higher_better', extractPattern: /([\d.]+)\s*inch/i },
    performance: { specPath: 'Performance_Level', direction: 'higher_better' },
    battery:     { specPath: 'Battery', direction: 'higher_better', extractPattern: /~?\s*(\d+)\s*giờ/i },
    price:       { specPath: 'price', direction: 'lower_better' },
  },

  CAT_004: {
    sound:    { specPath: 'Driver', direction: 'higher_better', extractPattern: /(\d+)\s*mm/i },
    anc:      { specPath: 'ANC', direction: 'higher_better' }, // text scale, xử lý riêng
    battery:  { specPath: 'Battery', direction: 'higher_better', extractPattern: /(\d+)\s*giờ/i },
    price:    { specPath: 'price', direction: 'lower_better' },
  },

  CAT_005: {
    price:       { specPath: 'price', direction: 'lower_better' },
    durability:  { specPath: 'Security', direction: 'higher_better' }, // text scale
    performance: { specPath: 'MaxOutput', direction: 'higher_better', extractPattern: /(\d+)\s*W/i },
  },

  CAT_006: {
    performance: { specPath: 'Sensor', direction: 'higher_better', extractPattern: /(\d+)\s*K\s*DPI/i },
    price:       { specPath: 'price', direction: 'lower_better' },
    design:      { specPath: 'Weight', direction: 'lower_better', extractPattern: /(\d+)\s*g/i },
    durability:  { specPath: 'Switch', direction: 'higher_better', extractPattern: /(\d+)\s*triệu/i },
  },
};


const TEXT_SCALE_RANK: Record<string, number> = {
  'thấp': 1, 'trung bình': 2, 'khá': 3, 'cao': 4, 'rất cao': 5,
  'premium cao cấp': 4, 'đỉnh cao': 5, 'đỉnh cao phụ kiện': 5, 'đỉnh cao chuột gaming': 5,
  'flagship': 5, 'tầm trung': 2,
  'chống ồn chủ động adaptive anc thông minh': 5,
  'hệ thống bảo vệ nhiệt thông minh activeshield 2.0': 4,
};


const MOCK_RESULT: AiResult = {
  recommendation: 'MacBook Air M5 13 inch 2026',
  confidence: 93,
  criteria_used: ['Học tập', 'Pin', 'Tiết kiệm chi phí'],
  summary: 'MacBook Air M5 vượt trội về thời lượng pin và thiết kế mỏng nhẹ, phù hợp với nhu cầu học tập di động cả ngày.',
  products: [
    {
      name: 'MacBook Air M5 13 inch 2026',
      variant_id: '',
      match_score: 95,
      pros: [
        'Pin lên đến 18 giờ, không cần mang sạc',
        'Chip M5 xử lý mượt mà mọi tác vụ học tập',
        'Thiết kế siêu mỏng nhẹ 1.24kg, dễ mang đi',
      ],
      cons: [
        'Hiệu suất đồ họa thấp hơn chip rời',
        'Hỗ trợ xuất màn hình rời hạn chế',
      ],
      who_should_buy: 'Học sinh, sinh viên, freelancer ưu tiên pin bền và thiết kế gọn nhẹ. Phù hợp làm việc văn phòng, lập trình nhẹ, và học tập cả ngày.',
    },
    {
      name: 'Laptop HP Omnibook 5',
      variant_id: '',
      match_score: 80,
      pros: [
        'Hiệu năng CPU & GPU cao hơn cho đồ họa nặng',
        'Phù hợp vừa giải trí vừa học tập & render',
      ],
      cons: [
        'Thân máy nặng hơn đối thủ (1.45kg)',
        'Thời lượng pin trung bình khi tải nặng',
      ],
      who_should_buy: 'Sinh viên kỹ thuật, designer cần hiệu năng đồ họa cao. Phù hợp khi thường xuyên cắm sạc hoặc làm việc tại chỗ.',
    },
  ],
};


const CRITERIA_PRESETS: Record<string, AiCriterion[]> = {
  default: [
    { key: 'price',       label: 'Giá cả',     weight: 70, enabled: true },
    { key: 'performance', label: 'Hiệu năng',  weight: 70, enabled: true },
    { key: 'design',      label: 'Thiết kế',   weight: 50, enabled: true },
    { key: 'durability',  label: 'Độ bền',     weight: 50, enabled: true },
  ],
  CAT_001: [ 
    { key: 'performance', label: 'Hiệu năng (CPU/GPU)',  weight: 80, enabled: true },
    { key: 'price',       label: 'Giá cả',               weight: 60, enabled: true },
    { key: 'design',      label: 'Thiết kế / Độ mỏng nhẹ', weight: 40, enabled: true },
    { key: 'battery',     label: 'Thời lượng Pin',       weight: 50, enabled: true },
    { key: 'brand',       label: 'Thương hiệu',          weight: 30, enabled: true },
  ],
  CAT_002: [ 
    { key: 'performance', label: 'Hiệu năng',  weight: 75, enabled: true },
    { key: 'camera',      label: 'Camera',     weight: 70, enabled: true },
    { key: 'battery',     label: 'Pin',        weight: 65, enabled: true },
    { key: 'price',       label: 'Giá cả',     weight: 60, enabled: true },
    { key: 'design',      label: 'Thiết kế',   weight: 40, enabled: true },
  ],
  CAT_003: [ 
    { key: 'display',     label: 'Màn hình',   weight: 75, enabled: true },
    { key: 'performance', label: 'Hiệu năng',  weight: 65, enabled: true },
    { key: 'battery',     label: 'Pin',        weight: 60, enabled: true },
    { key: 'price',       label: 'Giá cả',     weight: 55, enabled: true },
  ],
  CAT_004: [ 
    { key: 'sound',       label: 'Chất lượng âm thanh', weight: 85, enabled: true },
    { key: 'anc',         label: 'Chống ồn',            weight: 70, enabled: true },
    { key: 'battery',     label: 'Pin',                 weight: 55, enabled: true },
    { key: 'price',       label: 'Giá cả',              weight: 50, enabled: true },
  ],
  CAT_005: [ 
    { key: 'price',       label: 'Giá cả',     weight: 75, enabled: true },
    { key: 'durability',  label: 'Độ bền',     weight: 65, enabled: true },
    { key: 'performance', label: 'Hiệu năng',  weight: 60, enabled: true },
  ],
  CAT_006: [ 
    { key: 'performance', label: 'Hiệu năng',      weight: 90, enabled: true },
    { key: 'price',       label: 'Giá cả',         weight: 55, enabled: true },
    { key: 'design',      label: 'Thiết kế / RGB', weight: 45, enabled: true },
    { key: 'durability',  label: 'Độ bền',         weight: 50, enabled: true },
  ],
};


interface ProductScoring {
  variant_id: string;
  score: number;          
  strengths: string[];    
  weaknesses: string[];   
}


@Injectable({ providedIn: 'root' })
export class AiCompareService {


  private USE_MOCK = false;


  private _products$ = new BehaviorSubject<any[]>([]);
  private _criteria$ = new BehaviorSubject<AiCriterion[]>([]);
  private _result$   = new BehaviorSubject<AiResult | null>(null);
  private _loading$  = new BehaviorSubject<boolean>(false);

  products$ = this._products$.asObservable();
  criteria$ = this._criteria$.asObservable();
  result$   = this._result$.asObservable();
  loading$  = this._loading$.asObservable();

  
  setProducts(products: any[]): void {
    this._products$.next(products);
    this._result$.next(null); 
  }

  getProducts(): any[] {
    return this._products$.getValue();
  }

 
  getPresetCriteria(categoryId: string): AiCriterion[] {
    const preset = CRITERIA_PRESETS[categoryId] ?? CRITERIA_PRESETS['default'];
    return preset.map(c => ({ ...c })); 
  }


  private getEffectivePrice(product: any): number {
    const rawPrice = product.selectedVariant?.Price ?? product.min_price ?? 0;
    const discount = product.Discount ?? 0;
    return discount > 0 ? rawPrice * (1 - discount / 100) : rawPrice;
  }


  private extractRawValue(product: any, meta: CriterionScoringMeta): number | null {
    if (meta.specPath === 'price') {
      return this.getEffectivePrice(product);
    }

    const specs = product.Technical_specs ?? {};
    const rawField = specs[meta.specPath];
    if (rawField === undefined || rawField === null || rawField === '') return null;

    const fieldStr = String(rawField).trim();

    const normalized = fieldStr.toLowerCase();
    if (TEXT_SCALE_RANK[normalized] !== undefined) {
      return TEXT_SCALE_RANK[normalized];
    }

    const pattern = meta.extractPattern ?? /([\d.]+)/;
    const match = fieldStr.match(pattern);
    if (!match) return null;

    const num = parseFloat(match[1]);
    return isNaN(num) ? null : num;
  }


  private static readonly SCORE_FLOOR = 40;  
  private static readonly SCORE_CEIL  = 100; 
  private static readonly SCORE_MID   = 70;  

  private normalizeToScore(
    value: number,
    allValues: (number | null)[],
    direction: 'higher_better' | 'lower_better'
  ): number {
    const validValues = allValues.filter((v): v is number => v !== null && !isNaN(v));
    if (validValues.length === 0) return AiCompareService.SCORE_MID;

    const min = Math.min(...validValues);
    const max = Math.max(...validValues);


    if (min === max) return AiCompareService.SCORE_MID;

    const ratio = (value - min) / (max - min);
    const adjustedRatio = direction === 'higher_better' ? ratio : 1 - ratio;

    const range = AiCompareService.SCORE_CEIL - AiCompareService.SCORE_FLOOR;
    return Math.round(AiCompareService.SCORE_FLOOR + adjustedRatio * range);
  }

  calculateMatchScores(products: any[], criteria: AiCriterion[], categoryId: string): ProductScoring[] {
    const enabledCriteria = criteria.filter(c => c.enabled);
    const totalWeight = enabledCriteria.reduce((s, c) => s + c.weight, 0) || 1;
    const metaMap = SCORING_META[categoryId] ?? {};


    const rawValuesByCriterion: Record<string, (number | null)[]> = {};
    for (const criterion of enabledCriteria) {
      const meta = metaMap[criterion.key];
      rawValuesByCriterion[criterion.key] = products.map(p =>
        meta ? this.extractRawValue(p, meta) : null
      );
    }


    return products.map((product, idx) => {
      let weightedSum = 0;
      const strengths: string[] = [];
      const weaknesses: string[] = [];

      for (const criterion of enabledCriteria) {
        const meta = metaMap[criterion.key];
        if (!meta) continue; 

        const rawValue = rawValuesByCriterion[criterion.key][idx];
        const allValues = rawValuesByCriterion[criterion.key];

        const criterionScore = rawValue === null
          ? AiCompareService.SCORE_MID 
          : this.normalizeToScore(rawValue, allValues, meta.direction);

        weightedSum += criterionScore * (criterion.weight / totalWeight);

        
        if (criterionScore >= 75) strengths.push(criterion.label);
        if (criterionScore <= 65) weaknesses.push(criterion.label);
      }

      return {
        variant_id: product.selectedVariantId ?? product.selectedVariant?.Product_variant_id ?? '',
        score: Math.round(weightedSum),
        strengths,
        weaknesses,
      };
    });
  }

 
  analyze(products: any[], criteria: AiCriterion[], categoryId: string): Observable<AiResult> {
    this._loading$.next(true);
    this._criteria$.next(criteria);

    const scoring = this.calculateMatchScores(products, criteria, categoryId);

    if (this.USE_MOCK) {
      const mockResult: AiResult = {
        ...MOCK_RESULT,
        criteria_used: criteria.filter(c => c.enabled).map(c => c.label),
        products: MOCK_RESULT.products.map((p, i) => ({
          ...p,
          variant_id: scoring[i]?.variant_id ?? '',
          name: products[i]?.Product_name ?? p.name,
          match_score: scoring[i]?.score ?? p.match_score, 
        })),
      };
      return of(mockResult).pipe(
        delay(2500),
        map(result => {
          this._result$.next(result);
          this._loading$.next(false);
          return result;
        })
      );
    }

    return from(this.callGeminiApi(products, criteria, scoring)).pipe(
      map(narrative => {
        const result: AiResult = {
          recommendation: narrative.recommendation,
          confidence: narrative.confidence,
          criteria_used: criteria.filter(c => c.enabled).map(c => c.label),
          summary: narrative.summary,
          products: products.map((p, i) => {
            const aiProduct = narrative.products?.find(
              (np: any) => np.variant_id === scoring[i].variant_id
            ) ?? narrative.products?.[i] ?? {};


            const pros = aiProduct.pros?.length ? aiProduct.pros : ['Đáp ứng tốt nhu cầu sử dụng cơ bản'];
            const cons = aiProduct.cons?.length ? aiProduct.cons : ['Không có điểm yếu nổi bật so với đối thủ'];

            return {
              name: p.Product_name,
              variant_id: scoring[i].variant_id,
              match_score: scoring[i].score, 
              pros,
              cons,
              who_should_buy: aiProduct.who_should_buy ?? '',
            };
          }),
        };

        this._result$.next(result);
        this._loading$.next(false);
        return result;
      })
    );
  }


  buildPrompt(products: any[], criteria: AiCriterion[], scoring: ProductScoring[]): string {
    const activeCriteria = criteria.filter(c => c.enabled);
    const criteriaText = activeCriteria
      .map(c => `- ${c.label} (trọng số ${c.weight}%)`)
      .join('\n');

    const productsText = products.map((p, i) => {
      const s = scoring[i];
      const price = this.getEffectivePrice(p);
      const priceText = price ? Math.round(price).toLocaleString('vi-VN') + 'đ' : 'N/A';


      const relevantKeys = new Set(
        activeCriteria.map(c => SCORING_META[p.Category_id]?.[c.key]?.specPath).filter(Boolean)
      );
      const specs = p.Technical_specs ?? {};
      const specLines = Array.from(relevantKeys)
        .filter(key => key !== 'price' && specs[key as string] !== undefined)
        .map(key => `  - ${key}: ${specs[key as string]}`)
        .join('\n');

      return `SẢN PHẨM ${i + 1}: ${p.Product_name} (variant_id: ${s.variant_id})
- Giá: ${priceText}
- Điểm phù hợp đã tính: ${s.score}/100
- Điểm mạnh (theo tiêu chí): ${s.strengths.length ? s.strengths.join(', ') : 'không nổi bật'}
- Điểm yếu (theo tiêu chí): ${s.weaknesses.length ? s.weaknesses.join(', ') : 'không có điểm yếu rõ rệt'}
- Specs liên quan:
${specLines || '  (không có dữ liệu)'}`;
    }).join('\n\n');

    return `Tiêu chí người dùng ưu tiên:
${criteriaText}

Kết quả so sánh đã được tính điểm sẵn (KHÔNG được tự đổi số điểm này):
${productsText}`;
  }


  private async callGeminiApi(
    products: any[],
    criteria: AiCriterion[],
    scoring: ProductScoring[]
  ): Promise<any> {
    const apiKey = environment.geminiApiKey;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const systemInstruction = `Bạn là chuyên gia tư vấn công nghệ. Dựa trên điểm số và dữ liệu đã được tính toán sẵn (KHÔNG tự ý đổi điểm), hãy viết phần phân tích bằng tiếng Việt tự nhiên và trả về JSON đúng format sau, KHÔNG kèm bất kỳ text giải thích nào ngoài JSON:

QUY TẮC BẮT BUỘC:
- Mỗi sản phẩm PHẢI có ít nhất 2 pros VÀ ít nhất 2 cons, không được để mảng nào rỗng.
- Nếu dữ liệu ghi "không nổi bật" hoặc "không có điểm yếu rõ rệt", hãy TỰ SO SÁNH TƯƠNG ĐỐI giữa các sản phẩm đang xét để tìm ra ít nhất 1 ưu điểm và 1 nhược điểm hợp lý (ví dụ: giá nhỉnh hơn một chút, thiết kế dày hơn đối thủ, thiếu 1 tính năng phụ...). Không được để trống.
{
  "recommendation": "tên sản phẩm có điểm phù hợp cao nhất",
  "confidence": 90,
  "summary": "lý do ngắn gọn tại sao chọn sản phẩm đó, dựa trên điểm mạnh/yếu đã cho",
  "products": [
    {
      "variant_id": "đúng variant_id đã cho trong dữ liệu",
      "pros": ["điểm mạnh 1 viết tự nhiên", "điểm mạnh 2"],
      "cons": ["điểm yếu 1 viết tự nhiên", "điểm yếu 2"],
      "who_should_buy": "mô tả đối tượng phù hợp"
    }
  ]
}`;

    const userPrompt = this.buildPrompt(products, criteria, scoring);
    const fullPrompt = `${systemInstruction}\n\n${userPrompt}`;

    let attempt = 0;
    while (attempt < 2) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: {
              temperature: 0.7,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';


        const clean = rawText.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);

        if (!parsed.recommendation || !Array.isArray(parsed.products)) {
          throw new Error('Invalid AI response format');
        }

        return parsed;

      } catch (err) {
        attempt++;
        if (attempt >= 2) {
          this._loading$.next(false);
          throw err;
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    throw new Error('Không thể kết nối AI sau 2 lần thử');
  }

  getResult(): AiResult | null {
    return this._result$.getValue();
  }

  isLoading(): boolean {
    return this._loading$.getValue();
  }

  reset(): void {
    this._result$.next(null);
    this._loading$.next(false);
    this._criteria$.next([]);
  }
}