# Jay's Food Court

A luxury digital food ordering, multi-rider dispatch, and real-time operations web application.

## Key Features

- **Luxury Customer Ordering Experience:** Rich visual menu with authentic Nigerian delicacies, custom swallow combinations, multi-protein selections, and real-time cart calculations.
- **Paystack Payment Integration:** Automated webhook processing, reconciliation, and payment verification.
- **Multi-Role Operations Portals:**
  - Kitchen preparation dashboard with automated order ticket streaming.
  - Dispatch fleet management and rider assignment pools.
  - Rider delivery portal with turn-by-turn navigation deep links and face-to-face OTP verification.
  - Owner and manager administrative analytics, pricing controls, and audit trails.
- **Private Customer–Rider Communication:**
  - Real-time in-app private text messaging with read receipts and typing indicators over Supabase Realtime.
  - WebRTC two-way in-app voice calling powered by LiveKit Cloud with strict phone number masking.
- **GPS-Free Vector Delivery Tracking:** High-precision SVG vector progression tracking with honest ETA estimates and zero external map API fees.
- **PWA & Audio Synthesis:** Mobile web application with offline service worker support and Web Audio API synthesized ringtones.

## Tech Stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS (Obsidian `#17140D`, Gold `#FFB800`, Cream `#FFFBEF`)
- **Database & Realtime:** Supabase (PostgreSQL, Row Level Security, Realtime Publications)
- **Voice Infrastructure:** LiveKit Cloud (WebRTC Audio)
- **Payments:** Paystack
- **Emails:** Resend

## Getting Started

1. Clone the repository:
   ```bash
   git clone git@github.com:johnsonray1840-jpg/jays-food-court.git
   cd jays-food-court
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables in `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   npm start
   ```
