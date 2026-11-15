'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { MenuItem, CartLineItem } from '@/types';
import { Coordinates } from '@/lib/enugu-geocoding';

interface CartContextType {
  cart: CartLineItem[];
  cartCount: number;
  cartTotal: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  activeModalDish: MenuItem | null;
  setActiveModalDish: (dish: MenuItem | null) => void;
  addToCart: (item: CartLineItem) => void;
  updateQty: (index: number, delta: number) => void;
  removeUnavailableItems: (unavailableIds: number[]) => void;
  clearCart: () => void;
  deliveryLocation: string;
  setDeliveryLocation: (loc: string) => void;
  lastOrderId: string;
  setLastOrderId: (id: string) => void;
  toastMessage: { message: string | null; type: 'success' | 'error' };
  showToast: (message: string, type?: 'success' | 'error') => void;
  isPlacingOrder: boolean;
  placeOrder: (details: {
    customerName: string;
    email?: string;
    phone: string;
    address: string;
    landmark?: string;
    deliveryInstructions?: string;
    paymentMode: 'online';
    promoCode?: string;
    deliveryCoordinates?: Coordinates;
    deliveryZoneId?: string;
  }) => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children, menuItems = [] }: { children: React.ReactNode; menuItems?: MenuItem[] }) {
  const [cart, setCart] = useState<CartLineItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeModalDish, setActiveModalDish] = useState<MenuItem | null>(null);
  const [deliveryLocation, setDeliveryLocationState] = useState('Agbani, Enugu');
  const [lastOrderId, setLastOrderIdState] = useState('');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ message: string | null; type: 'success' | 'error' }>({
    message: null,
    type: 'success',
  });

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => {
      setToastMessage({ message: null, type: 'success' });
    }, 2800);
  }, []);

  const setLastOrderId = useCallback((id: string) => {
    setLastOrderIdState(id);
    try {
      localStorage.setItem('jfc_last_order', id);
    } catch {
      // ignore
    }
  }, []);

  // Hydrate local state on initial client mount and handle Paystack redirect callback
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('jfc_cart');
      if (savedCart) setCart(JSON.parse(savedCart));

      const savedLoc = localStorage.getItem('jfc_loc');
      if (savedLoc) setDeliveryLocationState(savedLoc);

      const savedLast = localStorage.getItem('jfc_last_order');
      if (savedLast) setLastOrderIdState(savedLast);

      const urlParams = new URLSearchParams(window.location.search);
      const paystackRef = urlParams.get('reference') || urlParams.get('trxref');
      if (paystackRef && window.location.pathname !== '/track') {
        showToast('Verifying your Paystack payment...');
        fetch(`/api/payments/verify?reference=${encodeURIComponent(paystackRef)}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.orderCode) {
              setLastOrderId(data.orderCode);
              localStorage.setItem('jfc_has_paid_order', 'true');
              showToast(`Payment confirmed! Order #${data.orderCode} sent to the kitchen!`);
              window.history.replaceState({}, document.title, window.location.pathname);
              if (window.location.pathname === '/') {
                window.location.assign(`/track?order=${encodeURIComponent(data.orderCode)}`);
              }
            } else {
              showToast(data.message || 'Payment verification could not be confirmed.', 'error');
            }
          })
          .catch(() => {
            showToast('Verification check failed. Please check your order status.', 'error');
          });
      }
    } catch {
      // Local storage fallback
    }
  }, [setLastOrderId, showToast]);

  // Sync cart changes to localStorage
  const syncCart = useCallback((updated: CartLineItem[]) => {
    setCart(updated);
    try {
      localStorage.setItem('jfc_cart', JSON.stringify(updated));
    } catch {
      // ignore
    }
  }, []);

  const setDeliveryLocation = useCallback((loc: string) => {
    setDeliveryLocationState(loc);
    try {
      localStorage.setItem('jfc_loc', loc);
    } catch {
      // ignore
    }
  }, []);

  const addToCart = useCallback((item: CartLineItem) => {
    setCart((prev) => {
      const updated = [...prev, item];
      try {
        localStorage.setItem('jfc_cart', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    showToast(`Added ${item.name} to cart`);
  }, [showToast]);

  const updateQty = useCallback((index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const target = updated[index];
      if (!target) return prev;
      target.qty += delta;
      if (target.qty <= 0) {
        updated.splice(index, 1);
      }
      try {
        localStorage.setItem('jfc_cart', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  const removeUnavailableItems = useCallback((unavailableIds: number[]) => {
    setCart((prev) => {
      const updated = prev.filter((item) => !unavailableIds.includes(item.id));
      try {
        localStorage.setItem('jfc_cart', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    showToast('Removed sold-out items from your tray', 'error');
  }, [showToast]);

  const clearCart = useCallback(() => {
    setCart([]);
    try {
      localStorage.removeItem('jfc_cart');
    } catch {
      // ignore
    }
  }, []);

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.unit * item.qty, 0);

  const placeOrder = useCallback(
    async (details: {
      customerName: string;
      email?: string;
      phone: string;
      address: string;
      landmark?: string;
      deliveryInstructions?: string;
      paymentMode: 'online';
      promoCode?: string;
      deliveryCoordinates?: Coordinates;
      deliveryZoneId?: string;
    }) => {
      if (cart.length === 0) return;
      setIsPlacingOrder(true);

      try {
        const idempotencyKey = 'idemp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
        const orderPayload = {
          idempotencyKey,
          customerName: details.customerName,
          email: details.email,
          phone: details.phone,
          address: details.address,
          landmark: details.landmark,
          deliveryInstructions: details.deliveryInstructions,
          paymentMode: 'online' as const,
          promoCode: details.promoCode,
          deliveryCoordinates: details.deliveryCoordinates,
          deliveryZoneId: details.deliveryZoneId,
          items: cart.map((i) => ({
            menuItemId: i.id,
            menuId: i.id,
            qty: i.qty,
            swallow: i.swallow || null,
            swallows: i.swallows || [],
            extras: i.extras || [],
            proteins: i.proteins || [],
            addons: i.addons || [],
            note: i.note || undefined,
          })),
        };

        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify(orderPayload),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to place order');
        }

        const orderId = data.order?.order_number || data.order?.id || data.orderCode;
        if (!orderId) {
          throw new Error('Order created but order reference was missing in server response.');
        }

        const customerEmail = details.email || `${details.phone.replace(/[^0-9]/g, '')}@guest.jaysfoodcourt.com`;

        // Initialize Paystack payment
        const payRes = await fetch('/api/payments/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderCode: orderId,
            email: customerEmail,
            callbackUrl: `${window.location.origin}/track?order=${encodeURIComponent(orderId)}`,
          }),
        });

        const payData = await payRes.json();

        if (!payRes.ok || !payData.authorizationUrl) {
          throw new Error(payData.error || 'Payment gateway initialization failed');
        }

        setLastOrderId(orderId);
        clearCart();
        setIsCartOpen(false);

        // Redirect customer to Paystack secure checkout
        window.location.href = payData.authorizationUrl;
      } catch (err: any) {
        showToast(err.message || 'Error checking out. Please retry.', 'error');
      } finally {
        setIsPlacingOrder(false);
      }
    },
    [cart, clearCart, setLastOrderId, showToast]
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        cartCount,
        cartTotal,
        isCartOpen,
        setIsCartOpen,
        activeModalDish,
        setActiveModalDish,
        addToCart,
        updateQty,
        removeUnavailableItems,
        clearCart,
        deliveryLocation,
        setDeliveryLocation,
        lastOrderId,
        setLastOrderId,
        toastMessage,
        showToast,
        isPlacingOrder,
        placeOrder,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
