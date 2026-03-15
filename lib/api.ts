export type ProductDetailResponse = {
  description: string;
  gallery: string[];
  options?: {
    sizes?: string[];
    colors?: string[];
    [k: string]: any;
  };
};

export const API = {
  async getProductDetails(_productUrl: string): Promise<ProductDetailResponse> {
    try {
      // Placeholder implementation to satisfy import and avoid runtime failures.
      // You can replace this with a backend call when available.
      return {
        description: '',
        gallery: [],
        options: { sizes: [], colors: [] },
      };
    } catch {
      return { description: '', gallery: [], options: { sizes: [], colors: [] } };
    }
  },
};
