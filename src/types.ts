export type ReceiptImage = {
  base64: string;
  mimeType: string;
};

export type AnalyzeCartInput = {
  domText?: string;
  receiptImage?: ReceiptImage;
  allergens: string[];
  targetVitamins?: string[];
};

export type CartItem = {
  name: string;
  flagged: boolean;
  reason?: string;
};

export type Recommendation = {
  title: string;
  url: string;
};

export type AllergenVerification = {
  name: string;
  containsAllergen: boolean;
  allergen: string | null;
};

export type AllergenVerificationResult = {
  items: AllergenVerification[];
  citations: string[];
};

export type AnalyzeCartResult = {
  items: CartItem[];
  warnings: string[];
  nutritionSummary: string;
  recommendations: Recommendation[];
  allergenVerification: AllergenVerificationResult;
};
