'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useCart } from '@/context/CartContext';
import { MenuItem } from '@/types';
import { Toast } from '@/components/ui/Toast';
import { BottomNav } from '@/components/layout/BottomNav';
import { FloatingMobileBar } from '@/components/cart/FloatingMobileBar';

const DishCustomizerModal = dynamic(
  () => import('@/components/menu/DishCustomizerModal').then((mod) => mod.DishCustomizerModal),
  { ssr: false }
);

const CartDrawer = dynamic(
  () => import('@/components/cart/CartDrawer').then((mod) => mod.CartDrawer),
  { ssr: false }
);

interface ClientShellProps {
  children: React.ReactNode;
  menuItems: MenuItem[];
}

export function ClientShell({ children, menuItems }: ClientShellProps) {
  const {
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
    placeOrder,
    isPlacingOrder,
    toastMessage,
  } = useCart();

  return (
    <>
      {toastMessage.message && (
        <Toast message={toastMessage.message} type={toastMessage.type} />
      )}

      {children}

      {/* Floating Mobile Cart Bar */}
      <FloatingMobileBar
        itemCount={cartCount}
        total={cartTotal}
        onOpenCart={() => setIsCartOpen(true)}
      />

      {/* Chowdeck-Style Mobile Bottom Navigation */}
      <BottomNav
        cartCount={cartCount}
        onOpenCart={() => setIsCartOpen(true)}
      />

      {/* Custom Dish Customizer Modal */}
      {activeModalDish && (
        <DishCustomizerModal
          dish={activeModalDish}
          onClose={() => setActiveModalDish(null)}
          onAddToCart={(item) => {
            addToCart(item);
            setActiveModalDish(null);
          }}
        />
      )}

      {/* Slide-over Cart & Checkout Drawer */}
      {isCartOpen && (
        <CartDrawer
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          items={cart}
          menuItems={menuItems}
          onRemoveUnavailableItems={() => {
            const unavailable = menuItems.filter((m) => !m.available).map((m) => m.id);
            removeUnavailableItems(unavailable);
          }}
          onUpdateQty={updateQty}
          onPlaceOrder={placeOrder}
          isLoading={isPlacingOrder}
        />
      )}
    </>
  );
}
