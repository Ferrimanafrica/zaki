import React, {
  PropsWithChildren,
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

type CartItemInput = Omit<CartItem, "quantity"> & { quantity?: number };

interface CartContextValue {
  cart: CartItem[];
  total: number;
  itemCount: number;
  addToCart: (item: CartItemInput) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: PropsWithChildren) {
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("@ferrimani/cart");
        if (raw) {
          const parsed: CartItem[] = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setCart(parsed);
          }
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem("@ferrimani/cart", JSON.stringify(cart));
      } catch {}
    })();
  }, [cart]);

  const addToCart = (item: CartItemInput) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((p) => p.id === item.id);
      if (existingIndex !== -1) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        const quantity = item.quantity ?? 1;
        updated[existingIndex] = {
          ...existing,
          quantity: existing.quantity + quantity,
        };
        return updated;
      }
      const quantity = item.quantity ?? 1;
      return [...prev, { ...item, quantity }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const itemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const value: CartContextValue = {
    cart,
    total,
    itemCount,
    addToCart,
    removeFromCart,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}