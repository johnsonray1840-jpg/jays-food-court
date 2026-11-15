'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MenuItem, CartLineItem } from '@/types';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/home/HeroSection';
import { PromoBanner } from '@/components/home/PromoBanner';
import { PopularDishes } from '@/components/home/PopularDishes';
import { MenuCatalog } from '@/components/menu/MenuCatalog';
import { HowItWorks } from '@/components/home/HowItWorks';
import { DishCustomizerModal } from '@/components/menu/DishCustomizerModal';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { FloatingMobileBar } from '@/components/cart/FloatingMobileBar';
import { OrderTracker } from '@/components/tracking/OrderTracker';
import { Toast } from '@/components/ui/Toast';

interface StorefrontClientProps {
  initialMenu: MenuItem[];
}

export function StorefrontClient({ initialMenu }: StorefrontClientProps) {
  const [cart, setCart] = useState<CartLineItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeModalDish, setActiveModalDish] = useState<MenuItem | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState('Agbani, Enugu');
  const [lastOrderId, setLastOrderId] = useState<string>('');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [toastState, setToastState] = useState<{ message: string | null; type: 'success' | 'error' }>({
    message: null,
    type: 'success',
  });

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToastState({ message, type });
    setTimeout(() => {
      setToastState({ message: null, type: 'success' });
    }, 2800);
  }, []);

  // Prevent background scroll when modal or drawer is active
  useEffect(() => {
    if (isCartOpen || activeModalDish) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isCartOpen, activeModalDish]);

  // Load local state on client mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('jfc_cart');
      if (savedCart) setCart(JSON.parse(savedCart));

      const savedLoc = localStorage.getItem('jfc_loc');
      if (savedLoc) setDeliveryLocation(savedLoc);

      const savedLastOrder = localStorage.getItem('jfc_last_order');
      if (savedLastOrder) setLastOrderId(savedLastOrder);
    } catch (e) {
      console.error('LocalStorage read error', e);
    }
  }, []);

  // Save cart changes
  const saveCart = (newCart: CartLineItem[]) => {
    setCart(newCart);
    try {
      localStorage.setItem('jfc_cart', JSON.stringify(newCart));
    } catch (e) {
      console.error('LocalStorage write error', e);
    }
  };

  const handleAddToCart = (item: CartLineItem) => {
    const existingIdx = cart.findIndex((i) => i.key === item.key);
    if (existingIdx > -1) {
      const updated = [...cart];
      updated[existingIdx].qty += item.qty;
      saveCart(updated);
    } else {
      saveCart([...cart, item]);
    }
    showToast(`${item.name} added to your bag`);
  };

  const handleUpdateQty = (idx: number, delta: number) => {
    const updated = [...cart];
    updated[idx].qty += delta;
    if (updated[idx].qty <= 0) {
      const removed = updated.splice(idx, 1);
      showToast(`Removed ${removed[0]?.name || 'dish'} from bag`);
    }
    saveCart(updated);
  };

  const handleLocationChange = () => {
    const newLoc = prompt('Enter delivery street or landmark in Agbani, Enugu:', deliveryLocation);
    if (newLoc && newLoc.trim()) {
      setDeliveryLocation(newLoc.trim());
      localStorage.setItem('jfc_loc', newLoc.trim());
      showToast(`Delivery location updated to ${newLoc.trim()}`);
    }
  };

  const handlePlaceOrder = async (details: {
    customerName: string;
    email?: string;
    phone: string;
    address: string;
    landmark?: string;
    deliveryInstructions?: string;
    paymentMode: 'transfer' | 'cod';
    promoCode?: string;
  }) => {
    setIsPlacingOrder(true);
    try {
      // Stage 4: Submit ONLY menu item IDs, quantities, customization IDs, instructions, and delivery details
      const idempotencyKey = 'idemp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      const payload = {
        idempotencyKey,
        customerName: details.customerName,
        email: details.email,
        phone: details.phone,
        address: details.address,
        landmark: details.landmark,
        deliveryInstructions: details.deliveryInstructions,
        paymentMode: details.paymentMode,
        promoCode: details.promoCode,
        items: cart.map((i) => ({
          menuId: i.id,
          qty: i.qty,
          swallow: i.swallow || null,
          extras: i.extras || [],
          note: i.note || undefined
        }))
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const orderId = data.order?.order_number || data.order?.id;
        setLastOrderId(orderId);
        localStorage.setItem('jfc_last_order', orderId);
        saveCart([]);
        setIsCartOpen(false);

        showToast(`Order #${orderId} received! Cooking starts now!`);

        // Smooth scroll to tracking section
        setTimeout(() => {
          const trackSection = document.getElementById('track');
          if (trackSection) {
            trackSection.scrollIntoView({ behavior: 'smooth' });
          }
        }, 150);
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Could not place order. Please check inputs.', 'error');
      }
    } catch (err) {
      console.error('Order placement error', err);
      showToast('Order failed. Please try again.', 'error');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.unit * item.qty, 0);
  const cartTotal = cartSubtotal > 0 ? cartSubtotal - Math.round(cartSubtotal * 0.3) + 500 : 0;

  const popularDishes = initialMenu.filter((item) => [1, 2, 4, 5].includes(item.id));

  return (
    <div className="min-h-screen flex flex-col justify-between" id="top">
      {/* Toast Notification */}
      <Toast message={toastState.message} type={toastState.type} />

      {/* Top Navbar */}
      <Navbar
        cartCount={cartCount}
        onOpenCart={() => setIsCartOpen(true)}
        locationText={deliveryLocation}
        onLocationClick={handleLocationChange}
      />

      {/* Main Content */}
      <main className="flex-1">
        <HeroSection
          onOrderClick={() => {
            const menuEl = document.getElementById('menu');
            if (menuEl) menuEl.scrollIntoView({ behavior: 'smooth' });
          }}
          onFeaturedDishClick={() => {
            const egusi = initialMenu.find((m) => m.id === 1) || initialMenu[0];
            setActiveModalDish(egusi);
          }}
        />

        <PromoBanner
          onClaimClick={() => {
            const menuEl = document.getElementById('menu');
            if (menuEl) menuEl.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        <PopularDishes
          dishes={popularDishes}
          onSelectDish={(dish) => setActiveModalDish(dish)}
        />

        <MenuCatalog
          items={initialMenu}
          onSelectDish={(dish) => setActiveModalDish(dish)}
        />

        <HowItWorks />

        <OrderTracker initialOrderId={lastOrderId} />
      </main>

      {/* Footer */}
      <Footer />

      {/* Floating Cart Button on Mobile */}
      <FloatingMobileBar
        itemCount={cartCount}
        total={cartTotal}
        onOpenCart={() => setIsCartOpen(true)}
      />

      {/* Dish Swallow & Protein Customization Modal */}
      <DishCustomizerModal
        dish={activeModalDish}
        onClose={() => setActiveModalDish(null)}
        onAddToCart={handleAddToCart}
      />

      {/* Cart & Guest Checkout Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQty={handleUpdateQty}
        onPlaceOrder={handlePlaceOrder}
        isLoading={isPlacingOrder}
      />
    </div>
  );
}
