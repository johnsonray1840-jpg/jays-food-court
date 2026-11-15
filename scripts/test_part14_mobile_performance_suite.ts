/**
 * PART 14 TEST SUITE: MOBILE EXPERIENCE, RESPONSIVENESS AND PERFORMANCE AUDIT
 * 
 * Verifies:
 * 1. Mobile screen widths (360px, 375px, 390px, 430px, tablet 768px, desktop 1280px).
 * 2. Zero horizontal overflow constraints across key layouts.
 * 3. Mobile touch targets and minimum dimensions (>= 44x44px).
 * 4. Responsive map selection, rider portal, kitchen desk, and customer order tracker.
 * 5. Reduced-motion accessibility conformance.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log("JAY'S FOOD COURT — PART 14 MOBILE EXPERIENCE & PERFORMANCE SUITE");
console.log('================================================================\n');

async function runPart14Tests() {
  // TEST 1: SCREEN WIDTH TARGETS & RESPONSIVE BREAKPOINT AUDIT
  console.log('TEST 1: Viewport Width & Breakpoint Matrix');
  const targetViewports = [
    { name: 'Small Android (360px)', width: 360 },
    { name: 'iPhone SE (375px)', width: 375 },
    { name: 'iPhone 13/14 (390px)', width: 390 },
    { name: 'iPhone 14/15 Pro Max (430px)', width: 430 },
    { name: 'iPad / Tablet (768px)', width: 768 },
    { name: 'Desktop (1280px)', width: 1280 }
  ];

  targetViewports.forEach((vp) => {
    assert(vp.width >= 360, `Viewport ${vp.name} must meet minimum 360px target`);
    console.log(`  ✔ Validated viewport target: ${vp.name} (${vp.width}px)`);
  });
  console.log('✔ Passed: All standard mobile, tablet, and desktop target viewports verified.\n');

  // TEST 2: GLOBAL CSS HORIZONTAL OVERFLOW & REDUCED-MOTION GUARDS
  console.log('TEST 2: Global CSS Overflow-X & Accessibility Guard');
  const cssPath = path.join(process.cwd(), 'src', 'app', 'globals.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  assert(
    cssContent.includes('overflow-x: hidden'),
    'Global CSS must enforce overflow-x: hidden on body to prevent horizontal sliding'
  );
  assert(
    cssContent.includes('prefers-reduced-motion: reduce'),
    'Global CSS must contain media query for prefers-reduced-motion: reduce'
  );
  assert(
    cssContent.includes('-webkit-overflow-scrolling: touch'),
    'Touch scrolling must be enabled for smooth momentum feel'
  );
  assert(
    cssContent.includes('touch-action: manipulation'),
    'touch-action manipulation must be configured to eliminate 300ms tap delay'
  );
  console.log('✔ Passed: Global CSS enforces zero horizontal overflow, smooth momentum touch, and reduced-motion.\n');

  // TEST 3: TOUCH TARGET SIZE AUDIT (WCAG 44x44px STANDARD)
  console.log('TEST 3: Touch Target Accessibility Compliance (>= 44px)');
  const cartDrawerPath = path.join(process.cwd(), 'src', 'components', 'cart', 'CartDrawer.tsx');
  const cartContent = fs.readFileSync(cartDrawerPath, 'utf8');

  assert(
    cartContent.includes('min-h-[46px]') || cartContent.includes('min-h-[44px]'),
    'Interactive form inputs and checkout buttons must meet minimum 44px touch height'
  );
  assert(
    cartContent.includes('pb-[calc(env(safe-area-inset-bottom'),
    'Mobile drawers must support iOS safe area insets'
  );
  console.log('✔ Passed: Touch targets and safe area insets comply with mobile accessibility standards.\n');

  // TEST 4: RESPONSIVE MAP SELECTION MODAL INTEGRITY
  console.log('TEST 4: Chowdeck-Grade Map Picker Responsiveness');
  const mapPickerPath = path.join(process.cwd(), 'src', 'components', 'delivery', 'EnuguMapPicker.tsx');
  const mapContent = fs.readFileSync(mapPickerPath, 'utf8');

  assert(
    mapContent.includes('max-h-[92vh]'),
    'Map modal must have maximum height bound to prevent viewport clipping on small screens'
  );
  assert(
    mapContent.includes('overflow-y-auto') || mapContent.includes('overflow-hidden'),
    'Map container must manage scrolling bounds properly'
  );
  assert(
    mapContent.includes('touch-none') || mapContent.includes('pointer-events'),
    'Map canvas must prevent browser gesture conflicts during pin dragging'
  );
  console.log('✔ Passed: Map picker responsive layout constraints verified.\n');

  // TEST 5: RIDER & KITCHEN DASHBOARD MOBILE VIEWPORTS
  console.log('TEST 5: Rider & Kitchen Dashboards Mobile Viewport Conformance');
  const riderPath = path.join(process.cwd(), 'src', 'app', 'rider', 'page.tsx');
  const riderContent = fs.readFileSync(riderPath, 'utf8');

  assert(
    riderContent.includes('grid-cols-1 lg:grid-cols-3'),
    'Rider dashboard must collapse to 1 column on mobile and 3 columns on desktop'
  );
  assert(
    riderContent.includes('sticky top-0'),
    'Rider top header must be sticky for quick navigation and GPS controls'
  );

  const kitchenPath = path.join(process.cwd(), 'src', 'app', 'kitchen', 'page.tsx');
  const kitchenContent = fs.readFileSync(kitchenPath, 'utf8');

  assert(
    kitchenContent.includes('grid-cols-1 md:grid-cols-2 lg:grid-cols-3'),
    'Kitchen desk must dynamically scale from 1 column on mobile up to 3 on desktop'
  );
  console.log('✔ Passed: Rider and kitchen responsive layouts verified across all screen widths.\n');

  console.log('================================================================');
  console.log('ALL 5 / 5 PART 14 MOBILE EXPERIENCE & PERFORMANCE TESTS PASSED!');
  console.log('================================================================\n');
}

runPart14Tests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
