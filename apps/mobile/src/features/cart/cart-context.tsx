import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";

import type { Product, Store } from "../../types/api";

export interface CartItem {
  product: Product;
  store: Store;
  quantity: number;
}

interface CartGroup {
  store: Store;
  items: CartItem[];
  subtotal: number;
}

interface CartContextValue {
  items: CartItem[];
  groups: CartGroup[];
  itemCount: number;
  total: number;
  addItem: (store: Store, product: Product) => void;
  incrementItem: (productId: string) => void;
  decrementItem: (productId: string) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  function addItem(store: Store, product: Product) {
    setItems((current) => {
      const existingItem = current.find((item) => item.product.id === product.id);

      if (existingItem) {
        return current.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: Math.min(99, item.quantity + 1) }
            : item
        );
      }

      return [...current, { store, product, quantity: 1 }];
    });
  }

  function incrementItem(productId: string) {
    setItems((current) =>
      current.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: Math.min(99, item.quantity + 1) }
          : item
      )
    );
  }

  function decrementItem(productId: string) {
    setItems((current) =>
      current
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeItem(productId: string) {
    setItems((current) =>
      current.filter((item) => item.product.id !== productId)
    );
  }

  const value = useMemo<CartContextValue>(() => {
    const groupMap = new Map<string, CartGroup>();

    for (const item of items) {
      const existingGroup = groupMap.get(item.store.id);
      const itemTotal = item.product.price * item.quantity;

      if (existingGroup) {
        existingGroup.items.push(item);
        existingGroup.subtotal += itemTotal;
      } else {
        groupMap.set(item.store.id, {
          store: item.store,
          items: [item],
          subtotal: itemTotal
        });
      }
    }

    return {
      items,
      groups: [...groupMap.values()],
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      total: items.reduce(
        (total, item) => total + item.product.price * item.quantity,
        0
      ),
      addItem,
      incrementItem,
      decrementItem,
      removeItem,
      clearCart: () => setItems([])
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart deve ser usado dentro de CartProvider");
  }

  return context;
}
