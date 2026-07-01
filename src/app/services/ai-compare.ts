// ============================================================
// AI COMPARE SERVICE — HYBRID: Rule-based scoring + Gemini API
// Đặt tại: src/app/services/ai-compare.service.ts
// ============================================================
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, from } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// ============================================================
// INTERFACES — để thẳng ở đây, không cần folder models/
// ============================================================
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

// Snapshot nhẹ của product — chỉ lưu đủ để result-page hiển thị
// lại ảnh, giá, tên khi xem từ lịch sử (không lưu toàn bộ product)
export interface AiSavedProduct {
  Product_name: string;
  Category_id: string;
  Images: string[];
  Discount: number;
  min_price: number;
  // Giá gốc (chưa trừ discount) đã được resolve sẵn tại thời điểm lưu.
  // KHÔNG dựng lại giá từ selectedVariant/variants nữa vì shape sản phẩm
  // gốc (selectedVariant object đơn vs variants mảng) không đồng nhất và
  // rất dễ mất dữ liệu khi snapshot → gây hiện 0đ khi mở lại từ history.
  // Lưu sẵn con số cuối cùng là cách chắc chắn nhất.
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
  savedProducts?: AiSavedProduct[]; // để restore lại ảnh/giá khi xem từ history-page
}

// ============================================================
// SCORING METADATA — mô tả cách rule-based chấm điểm từng tiêu chí
// specPath: field cần lấy trong Technical_specs (hoặc 'price' đặc biệt,
//           lấy từ variant.Price, không nằm trong Technical_specs)
// direction: higher_better | lower_better
// extractPattern: regex để bóc đúng con số cần thiết khi field là chuỗi
//                 hỗn hợp (vd "52.6Wh (~18 giờ)" muốn lấy số giờ thì
//                 regex khác với muốn lấy Wh)
// ============================================================
interface CriterionScoringMeta {
  specPath: string;
  direction: 'higher_better' | 'lower_better';
  extractPattern?: RegExp; // mặc định: lấy số đầu tiên xuất hiện trong chuỗi
}

const SCORING_META: Record<string, Record<string, CriterionScoringMeta>> = {
  // ---------------- Laptop ----------------
  CAT_001: {
    performance: { specPath: 'CPU', direction: 'higher_better', extractPattern: /(\d+)\s*-?core/i },
    price:       { specPath: 'price', direction: 'lower_better' },
    design:      { specPath: 'Weight', direction: 'lower_better', extractPattern: /([\d.]+)\s*kg/i },
    battery:     { specPath: 'Battery', direction: 'higher_better', extractPattern: /~?\s*(\d+)\s*giờ/i },
    brand:       { specPath: 'Performance_Level', direction: 'higher_better' }, // xử lý riêng (text scale), xem note bên dưới
  },
  // ---------------- Smartphone ----------------
  CAT_002: {
    performance: { specPath: 'Performance_Level', direction: 'higher_better' },
    camera:      { specPath: 'Camera', direction: 'higher_better', extractPattern: /(\d+)\s*MP/i },
    battery:     { specPath: 'Battery', direction: 'higher_better', extractPattern: /(\d+)\s*mAh/i },
    price:       { specPath: 'price', direction: 'lower_better' },
    design:      { specPath: 'Portability', direction: 'higher_better' },
  },
  // ---------------- Tablet ----------------
  CAT_003: {
    display:     { specPath: 'Display_Size', direction: 'higher_better', extractPattern: /([\d.]+)\s*inch/i },
    performance: { specPath: 'Performance_Level', direction: 'higher_better' },
    battery:     { specPath: 'Battery', direction: 'higher_better', extractPattern: /~?\s*(\d+)\s*giờ/i },
    price:       { specPath: 'price', direction: 'lower_better' },
  },
  // ---------------- Thiết bị âm thanh ----------------
  CAT_004: {
    sound:    { specPath: 'Driver', direction: 'higher_better', extractPattern: /(\d+)\s*mm/i },
    anc:      { specPath: 'ANC', direction: 'higher_better' }, // text scale, xử lý riêng
    battery:  { specPath: 'Battery', direction: 'higher_better', extractPattern: /(\d+)\s*giờ/i },
    price:    { specPath: 'price', direction: 'lower_better' },
  },
  // ---------------- Phụ kiện ----------------
  CAT_005: {
    price:       { specPath: 'price', direction: 'lower_better' },
    durability:  { specPath: 'Security', direction: 'higher_better' }, // text scale
    performance: { specPath: 'MaxOutput', direction: 'higher_better', extractPattern: /(\d+)\s*W/i },
  },
  // ---------------- Gaming ----------------
  CAT_006: {
    performance: { specPath: 'Sensor', direction: 'higher_better', extractPattern: /(\d+)\s*K\s*DPI/i },
    price:       { specPath: 'price', direction: 'lower_better' },
    design:      { specPath: 'Weight', direction: 'lower_better', extractPattern: /(\d+)\s*g/i },
    durability:  { specPath: 'Switch', direction: 'higher_better', extractPattern: /(\d+)\s*triệu/i },
  },
};

// Một số field không phải số mà là thang chữ (vd "Cao", "Rất cao", "Flagship")
// — quy ước điểm cố định để so sánh tương đối giữa các mức.
const TEXT_SCALE_RANK: Record<string, number> = {
  'thấp': 1, 'trung bình': 2, 'khá': 3, 'cao': 4, 'rất cao': 5,
  'premium cao cấp': 4, 'đỉnh cao': 5, 'đỉnh cao phụ kiện': 5, 'đỉnh cao chuột gaming': 5,
  'flagship': 5, 'tầm trung': 2,
  'chống ồn chủ động adaptive anc thông minh': 5,
  'hệ thống bảo vệ nhiệt thông minh activeshield 2.0': 4,
};

// ============================================================
// MOCK DATA — shape này = format JSON AI thật phải trả về
// ============================================================
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

// ============================================================
// PRESET TIÊU CHÍ THEO CATEGORY (giữ nguyên như cũ — UI tap-to-rank
// dùng key/label/weight/enabled, KHÔNG cần biết gì về SCORING_META)
// ============================================================
const CRITERIA_PRESETS: Record<string, AiCriterion[]> = {
  default: [
    { key: 'price',       label: 'Giá cả',     weight: 70, enabled: true },
    { key: 'performance', label: 'Hiệu năng',  weight: 70, enabled: true },
    { key: 'design',      label: 'Thiết kế',   weight: 50, enabled: true },
    { key: 'durability',  label: 'Độ bền',     weight: 50, enabled: true },
  ],
  CAT_001: [ // Laptop
    { key: 'performance', label: 'Hiệu năng (CPU/GPU)',  weight: 80, enabled: true },
    { key: 'price',       label: 'Giá cả',               weight: 60, enabled: true },
    { key: 'design',      label: 'Thiết kế / Độ mỏng nhẹ', weight: 40, enabled: true },
    { key: 'battery',     label: 'Thời lượng Pin',       weight: 50, enabled: true },
    { key: 'brand',       label: 'Thương hiệu',          weight: 30, enabled: true },
  ],
  CAT_002: [ // Smartphone
    { key: 'performance', label: 'Hiệu năng',  weight: 75, enabled: true },
    { key: 'camera',      label: 'Camera',     weight: 70, enabled: true },
    { key: 'battery',     label: 'Pin',        weight: 65, enabled: true },
    { key: 'price',       label: 'Giá cả',     weight: 60, enabled: true },
    { key: 'design',      label: 'Thiết kế',   weight: 40, enabled: true },
  ],
  CAT_003: [ // Tablet
    { key: 'display',     label: 'Màn hình',   weight: 75, enabled: true },
    { key: 'performance', label: 'Hiệu năng',  weight: 65, enabled: true },
    { key: 'battery',     label: 'Pin',        weight: 60, enabled: true },
    { key: 'price',       label: 'Giá cả',     weight: 55, enabled: true },
  ],
  CAT_004: [ // Thiết bị âm thanh
    { key: 'sound',       label: 'Chất lượng âm thanh', weight: 85, enabled: true },
    { key: 'anc',         label: 'Chống ồn',            weight: 70, enabled: true },
    { key: 'battery',     label: 'Pin',                 weight: 55, enabled: true },
    { key: 'price',       label: 'Giá cả',              weight: 50, enabled: true },
  ],
  CAT_005: [ // Phụ kiện
    { key: 'price',       label: 'Giá cả',     weight: 75, enabled: true },
    { key: 'durability',  label: 'Độ bền',     weight: 65, enabled: true },
    { key: 'performance', label: 'Hiệu năng',  weight: 60, enabled: true },
  ],
  CAT_006: [ // Gaming
    { key: 'performance', label: 'Hiệu năng',      weight: 90, enabled: true },
    { key: 'price',       label: 'Giá cả',         weight: 55, enabled: true },
    { key: 'design',      label: 'Thiết kế / RGB', weight: 45, enabled: true },
    { key: 'durability',  label: 'Độ bền',         weight: 50, enabled: true },
  ],
};

// Kết quả chấm điểm rule-based cho 1 sản phẩm
interface ProductScoring {
  variant_id: string;
  score: number;          // 0-100, weighted theo criteria
  strengths: string[];    // label tiêu chí mà sản phẩm này nổi trội
  weaknesses: string[];   // label tiêu chí mà sản phẩm này yếu
}

// ============================================================
// SERVICE
// ============================================================
@Injectable({ providedIn: 'root' })
export class AiCompareService {

  // Đổi thành false khi cần demo AI thật — giữ true ngoài lúc demo
  // để tiết kiệm quota free tier của Gemini
  private USE_MOCK = false;

  // State dùng chung giữa criteria-page và result-page
  private _products$ = new BehaviorSubject<any[]>([]);
  private _criteria$ = new BehaviorSubject<AiCriterion[]>([]);
  private _result$   = new BehaviorSubject<AiResult | null>(null);
  private _loading$  = new BehaviorSubject<boolean>(false);

  products$ = this._products$.asObservable();
  criteria$ = this._criteria$.asObservable();
  result$   = this._result$.asObservable();
  loading$  = this._loading$.asObservable();

  // Nhận products[] từ compare-page truyền sang
  setProducts(products: any[]): void {
    this._products$.next(products);
    this._result$.next(null); // reset kết quả cũ
  }

  getProducts(): any[] {
    return this._products$.getValue();
  }

  // Lấy preset tiêu chí theo category của sản phẩm
  getPresetCriteria(categoryId: string): AiCriterion[] {
    const preset = CRITERIA_PRESETS[categoryId] ?? CRITERIA_PRESETS['default'];
    return preset.map(c => ({ ...c })); // trả bản sao, không mutate gốc
  }

  // ============================================================
  // RULE-BASED SCORING — không gọi AI, tính match_score + điểm
  // mạnh/yếu để feed cho Gemini viết pros/cons bám sát số liệu
  // ============================================================
  private getEffectivePrice(product: any): number {
    const rawPrice = product.selectedVariant?.Price ?? product.min_price ?? 0;
    const discount = product.Discount ?? 0;
    return discount > 0 ? rawPrice * (1 - discount / 100) : rawPrice;
  }

  // Lấy giá trị thô (số) cho 1 tiêu chí của 1 sản phẩm theo SCORING_META
  private extractRawValue(product: any, meta: CriterionScoringMeta): number | null {
    if (meta.specPath === 'price') {
      return this.getEffectivePrice(product);
    }

    const specs = product.Technical_specs ?? {};
    const rawField = specs[meta.specPath];
    if (rawField === undefined || rawField === null || rawField === '') return null;

    const fieldStr = String(rawField).trim();

    // Field dạng thang chữ (vd "Cao", "Rất cao", "Flagship")
    const normalized = fieldStr.toLowerCase();
    if (TEXT_SCALE_RANK[normalized] !== undefined) {
      return TEXT_SCALE_RANK[normalized];
    }

    // Field dạng số lẫn trong chuỗi — bóc bằng extractPattern hoặc số đầu tiên
    const pattern = meta.extractPattern ?? /([\d.]+)/;
    const match = fieldStr.match(pattern);
    if (!match) return null;

    const num = parseFloat(match[1]);
    return isNaN(num) ? null : num;
  }

  // Chuẩn hóa tương đối trong nhóm sản phẩm đang so sánh.
  // Dùng compressed range 40→100 (thay vì 0→100) để tránh sản phẩm
  // bị điểm cực đoan (0%) khi chỉ thua kém 1-2 tiêu chí so với nhóm —
  // đặc biệt quan trọng khi chỉ so 2-3 sản phẩm với nhau.
  // Ví dụ: S25 Ultra (1st) = 100, Z Fold6 (last) = 40 thay vì 0.
  private static readonly SCORE_FLOOR = 40;  // điểm sàn tối thiểu
  private static readonly SCORE_CEIL  = 100; // điểm trần tối đa
  private static readonly SCORE_MID   = 70;  // giữa range, dùng khi không phân biệt được

  private normalizeToScore(
    value: number,
    allValues: (number | null)[],
    direction: 'higher_better' | 'lower_better'
  ): number {
    const validValues = allValues.filter((v): v is number => v !== null && !isNaN(v));
    if (validValues.length === 0) return AiCompareService.SCORE_MID;

    const min = Math.min(...validValues);
    const max = Math.max(...validValues);

    // Tất cả sản phẩm specs bằng nhau → không có sản phẩm nào nổi trội,
    // chia đều điểm giữa range, không phạt ai.
    if (min === max) return AiCompareService.SCORE_MID;

    const ratio = (value - min) / (max - min); // 0.0 → 1.0
    const adjustedRatio = direction === 'higher_better' ? ratio : 1 - ratio;

    const range = AiCompareService.SCORE_CEIL - AiCompareService.SCORE_FLOOR;
    return Math.round(AiCompareService.SCORE_FLOOR + adjustedRatio * range);
  }

  calculateMatchScores(products: any[], criteria: AiCriterion[], categoryId: string): ProductScoring[] {
    const enabledCriteria = criteria.filter(c => c.enabled);
    const totalWeight = enabledCriteria.reduce((s, c) => s + c.weight, 0) || 1;
    const metaMap = SCORING_META[categoryId] ?? {};

    // Bước 1: lấy raw value của từng tiêu chí cho từng sản phẩm
    const rawValuesByCriterion: Record<string, (number | null)[]> = {};
    for (const criterion of enabledCriteria) {
      const meta = metaMap[criterion.key];
      rawValuesByCriterion[criterion.key] = products.map(p =>
        meta ? this.extractRawValue(p, meta) : null
      );
    }

    // Bước 2: tính điểm từng sản phẩm
    return products.map((product, idx) => {
      let weightedSum = 0;
      const strengths: string[] = [];
      const weaknesses: string[] = [];

      for (const criterion of enabledCriteria) {
        const meta = metaMap[criterion.key];
        if (!meta) continue; // category này không có mapping cho tiêu chí -> bỏ qua, không cộng điểm

        const rawValue = rawValuesByCriterion[criterion.key][idx];
        const allValues = rawValuesByCriterion[criterion.key];

        const criterionScore = rawValue === null
          ? AiCompareService.SCORE_MID // thiếu dữ liệu → điểm trung tính, không phạt cũng không cộng
          : this.normalizeToScore(rawValue, allValues, meta.direction);

        weightedSum += criterionScore * (criterion.weight / totalWeight);

        // Ngưỡng điều chỉnh theo range 40→100:
        // strengths: ≥ 85 (tương đương top 25% của range)
        // weaknesses: ≤ 55 (tương đương bottom 25% của range)
        if (criterionScore >= 85) strengths.push(criterion.label);
        if (criterionScore <= 55) weaknesses.push(criterion.label);
      }

      return {
        variant_id: product.selectedVariantId ?? product.selectedVariant?.Product_variant_id ?? '',
        score: Math.round(weightedSum),
        strengths,
        weaknesses,
      };
    });
  }

  // Gọi phân tích — mock hoặc AI thật tùy USE_MOCK
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
          match_score: scoring[i]?.score ?? p.match_score, // mock cũng dùng score rule-based
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
        // Gộp: match_score luôn lấy từ rule-based, KHÔNG lấy từ Gemini
        // dù response có lỡ trả kèm field này.
        const result: AiResult = {
          recommendation: narrative.recommendation,
          confidence: narrative.confidence,
          criteria_used: criteria.filter(c => c.enabled).map(c => c.label),
          summary: narrative.summary,
          products: products.map((p, i) => {
            const aiProduct = narrative.products?.find(
              (np: any) => np.variant_id === scoring[i].variant_id
            ) ?? narrative.products?.[i] ?? {};

            return {
              name: p.Product_name,
              variant_id: scoring[i].variant_id,
              match_score: scoring[i].score, // rule-based, không lấy từ AI
              pros: aiProduct.pros ?? [],
              cons: aiProduct.cons ?? [],
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

  // Tạo prompt gửi AI — rút gọn: KHÔNG yêu cầu AI tính match_score,
  // chỉ đưa kết quả đã tính sẵn + specs liên quan tiêu chí để AI viết văn bản
  buildPrompt(products: any[], criteria: AiCriterion[], scoring: ProductScoring[]): string {
    const activeCriteria = criteria.filter(c => c.enabled);
    const criteriaText = activeCriteria
      .map(c => `- ${c.label} (trọng số ${c.weight}%)`)
      .join('\n');

    const productsText = products.map((p, i) => {
      const s = scoring[i];
      const price = this.getEffectivePrice(p);
      const priceText = price ? Math.round(price).toLocaleString('vi-VN') + 'đ' : 'N/A';

      // Chỉ đưa specs liên quan tới tiêu chí đã chọn — không nhồi toàn bộ
      // Technical_specs để tiết kiệm token.
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

  // ============================================================
  // GỌI GEMINI API — chỉ để viết phần văn bản (pros/cons/recommendation/
  // who_should_buy/confidence/summary), KHÔNG yêu cầu tính match_score
  // ============================================================
  private async callGeminiApi(
    products: any[],
    criteria: AiCriterion[],
    scoring: ProductScoring[]
  ): Promise<any> {
    const apiKey = environment.geminiApiKey;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const systemInstruction = `Bạn là chuyên gia tư vấn công nghệ. Dựa trên điểm số và dữ liệu đã được tính toán sẵn (KHÔNG tự ý đổi điểm), hãy viết phần phân tích bằng tiếng Việt tự nhiên và trả về JSON đúng format sau, KHÔNG kèm bất kỳ text giải thích nào ngoài JSON:
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

        // Dù đã ép responseMimeType: application/json, vẫn giữ clean
        // làm fallback phòng khi model chèn text/markdown thừa.
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