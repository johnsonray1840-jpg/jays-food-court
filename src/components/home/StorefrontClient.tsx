'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { MenuItem, CartLineItem } from '@/types';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/home/HeroSection';
import { PromoBanner } from '@/components/home/PromoBanner';
import { PopularDishes } from '@/components/home/PopularDishes';
import { MenuCatalog } from '@/components/menu/MenuCatalog';
import { HowItWorks } from '@/components/home/HowItWorks';
import { FloatingMobileBar } from '@/components/cart/FloatingMobileBar';
import { BottomNav } from '@/components/layout/BottomNav';
import { OrderTracker } from '@/components/tracking/OrderTracker';
import { Toast } from '@/components/ui/Toast';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const DishCustomizerModal = dynamic(
  () => import('@/components/menu/DishCustomizerModal').then((mod) => mod.DishCustomizerModal),
  { ssr: false }
);

const CartDrawer = dynamic(
  () => import('@/components/cart/CartDrawer').then((mod) => mod.CartDrawer),
  { ssr: false }
);

interface StorefrontClientProps {
  initialMenu: MenuItem[];
}

export function StorefrontClient({ initialMenu }: StorefrontClientProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenu);
  const [cart, setCart] = useState<CartLineItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeModalDish, setActiveModalDish] = useState<MenuItem | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState('Agbani, Enugu');
  const [lastOrderId, setLastOrderId] = useState<string>('');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [hasPaidOrder, setHasPaidOrder] = useState<boolean>(false);
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

      // Check for Paystack callback redirect ?reference=... or ?order=...
      const urlParams = new URLSearchParams(window.location.search);
      const paystackRef = urlParams.get('reference') || urlParams.get('trxref');
      const orderParam = urlParams.get('order');

      if (paystackRef) {
        showToast('Verifying your Paystack payment...');
        fetch(`/api/payments/verify?reference=${encodeURIComponent(paystackRef)}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              showToast(`Payment confirmed! Order #${data.orderCode} sent to the kitchen!`);
              setLastOrderId(data.orderCode);
              setHasPaidOrder(true);
              localStorage.setItem('jfc_last_order', data.orderCode);
              localStorage.setItem('jfc_has_paid_order', 'true');
              // Clean URL params without reloading
              window.history.replaceState({}, document.title, window.location.pathname);
              // Scroll to tracker
              setTimeout(() => {
                const trackSection = document.getElementById('track');
                if (trackSection) trackSection.scrollIntoView({ behavior: 'smooth' });
              }, 200);
            } else {
              showToast(data.message || 'Payment verification could not be confirmed.', 'error');
            }
          })
          .catch(() => {
            showToast('Verification check failed. Please check your order status below.', 'error');
          });
      } else if (orderParam) {
        setLastOrderId(orderParam);
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => {
          const trackSection = document.getElementById('track');
          if (trackSection) trackSection.scrollIntoView({ behavior: 'smooth' });
        }, 200);
      }

      // Check server-side verified customer payment status
      fetch('/api/customer/me', { cache: 'no-store' })
        .then((res) => res.json())
        .then((data) => {
          if (data.authenticated && data.hasPaidOrder) {
            setHasPaidOrder(true);
            localStorage.setItem('jfc_has_paid_order', 'true');
          } else {
            // Check local fallback flag
            const localPaid = localStorage.getItem('jfc_has_paid_order') === 'true';
            setHasPaidOrder(localPaid);
          }
        })
        .catch(() => {
          const localPaid = localStorage.getItem('jfc_has_paid_order') === 'true';
          setHasPaidOrder(localPaid);
        });
    } catch (e) {
      console.error('LocalStorage read error', e);
    }
  }, [showToast]);

  // Keep menu in sync when server props update or customer returns to the tab / bfcache
  useEffect(() => {
    setMenuItems(initialMenu);
  }, [initialMenu]);

  useEffect(() => {
    let active = true;
    const refreshLiveMenu = async () => {
      try {
        const res = await fetch('/api/menu', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (active && Array.isArray(data.items)) {
          setMenuItems(data.items);
        }
      } catch {
        // Ignore transient network errors when tab regains focus
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshLiveMenu();
      }
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void refreshLiveMenu();
      }
    };

    window.addEventListener('focus', refreshLiveMenu);
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibility);

    // Active Real-Time Polling fallback (every 5 seconds) to ensure immediate availability sync without manual refresh
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshLiveMenu();
      }
    }, 5000);

    // Supabase Realtime Listener (when configured)
    const supabase = getSupabaseBrowserClient();
    let realtimeChannel: any = null;

    if (supabase) {
      try {
        realtimeChannel = supabase
          .channel('menu-realtime-availability')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'menu_items' },
            () => {
              void refreshLiveMenu();
            }
          )
          .subscribe();
      } catch (e) {
        console.warn('Realtime subscription error', e);
      }
    }

    return () => {
      active = false;
      clearInterval(pollInterval);
      if (realtimeChannel && supabase) {
        supabase.removeChannel(realtimeChannel);
      }
      window.removeEventListener('focus', refreshLiveMenu);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
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
    // Check if the dish is currently marked available in live menu
    const targetDish = menuItems.find((m) => m.id === item.id);
    if (targetDish && !targetDish.available) {
      showToast(`Sorry, ${item.name} is currently sold out.`, 'error');
      return;
    }

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

  const handleRemoveUnavailableItems = useCallback(() => {
    const availableItems = cart.filter((item) => {
      const menuItem = menuItems.find((m) => m.id === item.id);
      return !menuItem || menuItem.available;
    });
    saveCart(availableItems);
    showToast('Removed unavailable items from your order bag');
  }, [cart, menuItems, showToast]);

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
    paymentMode: 'online';
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
          swallows: i.swallows || [],
          extras: i.extras || [],
          proteins: i.proteins || [],
          addons: i.addons || [],
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
        const customerEmail = details.email || `${details.phone.replace(/[^0-9]/g, '')}@guest.jaysfoodcourt.com`;

        // Initialize Paystack payment
        const payRes = await fetch('/api/payments/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderCode: orderId,
            email: customerEmail,
            callbackUrl: `${window.location.origin}/?order=${orderId}`
          })
        });

        const payData = await payRes.json();

        if (payRes.ok && payData.authorizationUrl) {
          saveCart([]);
          setIsCartOpen(false);
          setLastOrderId(orderId);
          localStorage.setItem('jfc_last_order', orderId);

          showToast('Redirecting to Paystack secure checkout...');
          // Redirect to Paystack secure checkout
          window.location.href = payData.authorizationUrl;
          return;
        }

        // If payment init failed
        showToast(payData.error || 'Payment gateway connection failed. Please retry.', 'error');
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

  const popularDishes = menuItems.filter((item) => [1, 2, 4, 5].includes(item.id));

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
        showProfile={hasPaidOrder}
      />

      {/* Main Content */}
      <main className="flex-1">
        <HeroSection
          onOrderClick={() => {
            const menuEl = document.getElementById('menu');
            if (menuEl) menuEl.scrollIntoView({ behavior: 'smooth' });
          }}
          onFeaturedDishClick={() => {
            const egusi = menuItems.find((m) => m.id === 1) || menuItems[0];
            if (egusi) setActiveModalDish(egusi);
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
          items={menuItems}
          onSelectDish={(dish) => setActiveModalDish(dish)}
        />

        <HowItWorks />

        <OrderTracker initialOrderId={lastOrderId} />
      </main>

      {/* Footer */}
      <Footer />

      {/* Chowdeck Mobile Bottom Navigation */}
      <BottomNav cartCount={cartCount} onOpenCart={() => setIsCartOpen(true)} />

      {/* Floating Cart Button on Mobile */}
      <FloatingMobileBar
        itemCount={cartCount}
        total={cartTotal}
        onOpenCart={() => setIsCartOpen(true)}
      />

      {/* Dish Swallow & Protein Customization Modal */}
      {activeModalDish && (
        <DishCustomizerModal
          dish={activeModalDish}
          onClose={() => setActiveModalDish(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Cart & Guest Checkout Drawer */}
      {isCartOpen && (
        <CartDrawer
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          items={cart}
          menuItems={menuItems}
          onRemoveUnavailableItems={handleRemoveUnavailableItems}
          onUpdateQty={handleUpdateQty}
          onPlaceOrder={handlePlaceOrder}
          isLoading={isPlacingOrder}
        />
      )}
    </div>
  );
}
