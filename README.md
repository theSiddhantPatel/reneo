# Reneo Live — Full-Stack Live Commerce Platform

A production-ready live-commerce platform slice built for solo entrepreneurs. A seller goes live to showcase products, while customers can join the stream, watch in real-time with ultra-low latency, chat with the seller and other viewers, inspect detailed product specifications, send floating emoji reactions, and manage their cart—all without leaving or interrupting the live broadcast.

---

## 1. Tech Stack

- **Frontend**: React 18, TypeScript, Vite, React Router DOM, Agora RTC SDK (`agora-rtc-sdk-ng`), Supabase JS Client (`@supabase/supabase-js`).
- **Backend**: Node.js, Express, TypeScript, Agora Access Token SDK (`agora-token`), Supabase Client (`@supabase/supabase-js`), Vitest (`vitest`).
- **Database & Cloud Services (Supabase)**:
  - **Auth**: Email/password authentication with JWT metadata and role segregation (`seller` vs `customer`).
  - **Database (PostgreSQL)**: Relational schema with Row Level Security (RLS) policies.
  - **Storage**: `product-images` bucket for product media with folder-level isolation.
  - **Realtime**: Supabase Broadcast channels for sub-30ms chat and floating emoji reactions, Postgres Changes for database synchronization, and Supabase Presence for live audience tracking.
- **Live Video (Agora RTC)**: Server-side token generation, enforcing `publisher` (host) vs `subscriber` (audience) permissions.

---

## 2. Architecture Diagram

```
+---------------------------------------------------------------------------------------------------+
|                                          CLIENT LAYER                                             |
|  +---------------------------------------------------------------------------------------------+  |
|  |                                  React + TypeScript (Vite)                                  |  |
|  |  - Seller: Create Products -> Go Live -> Switch Pinned Product -> Host Controls (Mic/Cam)  |  |
|  |  - Customer: Feed -> Watch Live -> Player Controls -> Live Chat -> Live Reactions -> Cart  |  |
|  +----------------------------------------------+----------------------------------------------+  |
+-------------------------------------------------|-------------------------------------------------+
                                                  |
                        +-------------------------+-------------------------+
                        |                                                   |
                        v (HTTPS / REST)                                    v (WebSockets / REST)
+-----------------------------------------------+                  +--------------------------------+
|             BACKEND API (Express)             |                  |     SUPABASE CLOUD PLATFORM    |
|  - Bearer JWT Auth Middleware                 |                  |  - Auth: Users & Profiles      |
|  - Ownership & Host Role Validation           |                  |  - PostgreSQL with RLS         |
|  - Start / End Live Lifecycle & Beacon        |                  |  - Storage: product-images     |
|  - Server Agora Token Builder (Privilege Bit) |                  |  - Realtime: Chat & Reactions  |
+-----------------------+-----------------------+                  +--------------------------------+
                        |
                        v (RTC Token)
+-----------------------------------------------+
|                AGORA RTC SD-RTN               |
|  - Host: Publishes Camera & Mic A/V Tracks    |
|  - Audience: Subscribes to Audio/Video Only   |
+-----------------------------------------------+
```

---

## 3. Features Implemented

### Part A — Core Requirements (100% Complete)
- **A1 & A2. Authentication & Roles**: Supabase Auth with metadata, `profiles` table trigger, role-based routing (`seller` vs `customer`), and public route guards.
- **A3. Seller Product & Inventory Management**: Product creation (title, description, price, stock, image upload to Supabase Storage) along with interactive stock management (inline `+`/`-` steppers, direct quantity editor, and quick restock presets).
- **A4 & A5. Start & Manage Live Broadcast**: Seller goes live with a product $\rightarrow$ `POST /api/live` creates session $\rightarrow$ Server generates Agora publisher token. Host controls include mic mute/unmute, camera toggle, camera switching, in-stream live restock, full-screen, and broadcast termination (with `beforeunload` keepalive beacon).
- **A6. Customer Discovery & Stream Viewing**: Live stream feed on `/customer`, stream joining, non-disruptive product modal, persistent cart management with stock limit validation.
- **A7. Customer Player Controls**: Mute/unmute, volume slider and step controls (`🔉 -`, `🔊 +`), video hide/show toggle, native full-screen mode, and leave stream button.
- **A8. Real-Time Live Chat**: Bidirectional chat powered by Supabase Realtime and database persistence (`live_messages`). Structured with left/right messaging app bubbles, author names, timestamps, and deduplication.
- **A9. Security & RLS**: Complete Row-Level Security on all tables and storage buckets.
- **A10. Error Handling & Edge Cases**: Informative toast alerts for permissions, device unavailability, ended streams, and network interruptions.

### Part B — Bonus Features Implemented
- 🌟 **Live Floating Emoji Reactions (❤️, 🔥, 👏, 🚀, 🛍️)**: Customers tap floating reaction pills; emojis animate and bubble up across all viewers' screens in sub-30ms using Supabase Broadcast channels without database write bottlenecks.
- 🌟 **Multi-Product Showcase & Real-Time Product Switching**: The seller can pin and switch between multiple products from their inventory during the broadcast. All connected customers' featured product drawer, price, details, and "Add to Cart" button switch instantly in real-time without pausing the Agora live video stream.
- 🌟 **Real-Time Viewer Count**: Powered by Supabase Presence, automatically excluding the host from audience numbers.
- 🌟 **Automated Unit & Integration Test Suite**: 10 Vitest tests verifying Agora token generator privilege bitmasks, role validation, Bearer auth header parsing, and cart calculation boundaries.
- 🌟 **Outstanding Mobile Experience**: Mobile tab bar switcher (`💬 Live Chat`, `🛍️ Featured Product`, `🛒 Cart`), fluid responsive viewports, and non-blocking drawer overlays.

---

## 4. Getting Started & Setup

### Prerequisites
- Node.js (v18 or higher)
- npm / yarn / pnpm
- Supabase Project & Agora Developer Account

### 1. Repository Setup & Dependencies
```bash
# Clone the repository
git clone <your-repo-url>
cd reneo

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Database & Storage Setup
1. Open your Supabase project dashboard -> **SQL Editor**.
2. Run the SQL script from [`supabase/schema.sql`](supabase/schema.sql). This creates all tables (`profiles`, `products`, `live_sessions`, `live_messages`, `cart_items`), the profile creation trigger, and all RLS policies.
3. Verify public bucket `product-images` in Supabase Storage.

### 3. Environment Configuration

#### Backend `.env` (`backend/.env`):
```env
PORT=4000
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<your-supabase-anon-or-publishable-key>
AGORA_APP_ID=<your-agora-app-id>
AGORA_APP_CERTIFICATE=<your-agora-app-certificate>
```

#### Frontend `.env` (`frontend/.env`):
```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-supabase-anon-or-publishable-key>
VITE_BACKEND_URL=http://localhost:4000
```

### 4. Running Locally & Testing
```bash
# Start backend (from backend directory)
npm run dev

# Run automated test suite (from backend directory)
npm test

# Start frontend in another terminal (from frontend directory)
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 5. Key Technical Decisions & Justifications

### A. Non-Disruptive Product Inspection (A6)
- **Design Choice**: In-stream Product Modal / Drawer.
- **Justification**: In live-commerce, customer engagement drops dramatically if navigating away breaks or pauses the video stream. By rendering an interactive modal overlay over the active video container, the Agora media track and WebRTC connection continue running seamlessly without unmounting, re-buffering, or losing chat context.

### B. Deliberate Host vs. Audience Agora Roles (A5 & A10)
- **Design Choice**: Server-side role resolution and token issuance (`POST /api/agora/token`).
- **Justification**: The frontend never holds the Agora App Certificate. When joining a channel, the backend inspects the authenticated Supabase user session and checks whether the user is the assigned host of that live session. Only the verified host receives a `publisher` token. Customers receive `subscriber` tokens and cannot publish media tracks to the channel.

### C. Sub-30ms Reactions & Dual-Layer Realtime (A7 & Part B)
- **Design Choice**: Supabase Realtime Broadcast for instant chat and floating emojis + Postgres Changes for persistence.
- **Justification**: High-frequency events like emoji reactions and optimistic chat should never flood relational database write pools. Using Realtime Broadcast channels provides peer delivery with zero disk I/O, while Postgres Changes handles reliable database sync.

---

## 6. Security & Access Control (A10)

> **What stops a user from editing the ID in a request and deleting another seller's product?**

1. **Row Level Security (RLS) is the authoritative boundary**:
   - The `products` delete policy explicitly requires `WHERE seller_id = auth.uid()`.
   - The update policy requires `seller_id = auth.uid()` in both the `USING` and `WITH CHECK` clauses.
   - Even if an attacker manually modifies the product UUID in a network request, PostgreSQL evaluates the authenticated JWT (`auth.uid()`) against the row's `seller_id` and rejects unauthorized operations at the database level with 0 rows affected or a permission error.
2. **Backend API Verification**:
   - Starting a live broadcast (`POST /api/live`) verifies that the requested `productId` belongs to the requesting seller (`product.seller_id === userId`).
   - Ending a live broadcast (`PATCH /api/live/:liveId/end`) verifies that `live.host_id === userId`.
3. **Storage Isolation**:
   - Supabase Storage policies enforce that sellers can only upload and delete files located in their own user folder (`(storage.foldername(name))[1] = auth.uid()::text`).
4. **Secret Protection**:
   - Agora App Certificate is strictly stored in backend environment variables and is never bundled in frontend assets.
5. **Credential Security & Strength Enforcement**:
   - Client-side real-time password strength validation enforces minimum 8 characters, checks for complexity (mixed case, numbers, symbols), and prevents trivial/sequential patterns (e.g. `111111`, `password`, `123456`) on new signups.

---

## 7. Comprehensive Error Handling (A11)

The application handles edge cases with clear, actionable user messages:
- **Camera/Microphone Permission Denied**: Explicit alert instructing the user to enable browser permissions.
- **No Secondary Camera Found**: Informs the seller if their device lacks multiple camera inputs.
- **Live Stream Ended**: Automatically closes Agora tracks and presents an informative banner allowing the customer to continue viewing the product and cart.
- **Browser Tab / Window Close**: `beforeunload` beacon sends an asynchronous termination signal (`keepalive: true`) so abandoned streams don't linger.
- **Agora Connection Failure / Interruption**: Catches network interruptions and offers retry/reconnection indicators.
- **Invalid Session / Token Expiry**: Redirects to authentication with clear feedback.

---

## 8. Part C — Written Questions

### 1. Which part of this would break first if 500 customers joined the same live? What would you change?
- **The Bottleneck**: Supabase Realtime chat fan-out and database writes would encounter heavy pressure before Agora's media infrastructure (since Agora SD-RTN is architected for massive WebRTC broadcast distribution). If 500 viewers rapidly send chat messages, subscribing to raw Postgres changes on every row insert can saturate client-side rendering and database replication streams.
- **What I Would Change**:
  1. **Chat Fan-out & Ingestion**: Decouple live chat writes from direct DB triggers. Route messages through a lightweight Redis Pub/Sub cluster or Supabase Broadcast channels, writing messages to PostgreSQL in throttled background micro-batches.
  2. **Presence Throttling**: Aggregate audience viewer counts server-side (e.g., Redis hyperloglog / counter updated periodically) rather than full state synchronization to all 500 connected clients.
  3. **Frontend Message Virtualization**: Implement windowing (e.g. `react-window`) so long chat logs maintain consistent 60fps rendering.

### 2. What did you not have time to do, and what would you do next with two more days?
1. **Payment Gateway Integration**: Integrate Stripe / Paystack checkout session API to complete order fulfillment from the in-stream cart.
2. **Live Cloud Recording**: Connect Agora Cloud Recording REST API with AWS S3 storage for automatic VoD playback after a stream ends.
3. **Automated End-to-End Tests**: Add Playwright test suites simulating multi-browser live commerce interactions between sellers and audience members.

### 3. Where did you use a library or an AI assistant to do something you would not have been able to write yourself, and what did you learn afterwards?
- **Where I Used an AI Assistant & Libraries**:
  1. **Agora WebRTC Token Generation (`agora-token`)**: Configuring the `RtcTokenBuilder` privilege bitmasks (`kJoinChannel`, `kPublishAudioTrack`, `kPublishVideoTrack`) and writing a deterministic algorithm to map Supabase UUIDs to Agora numerical integer UIDs.
  2. **Dual-Layer Real-Time Architecture**: Structuring the hybrid real-time communication pipeline using Supabase Broadcast channels for zero-latency peer delivery (live chat & floating emoji reactions) paired with PostgreSQL Changes for persistent message storage.
  3. **Project Scaffolding & Mobile UI Ergonomics**: Rapidly structuring the full-stack TypeScript workspace and refining mobile-responsive layouts (handling soft keyboard viewport shifts, preventing iOS 16px input auto-zoom, and touch-friendly controls).
- **What I Learned Afterwards**:
  1. **Cryptographic WebRTC Role Segregation**: Agora media security is enforced at the cryptographic token layer on the backend—not the client. Clients cannot upgrade themselves from subscriber to publisher without a backend-signed privilege token.
  2. **Real-Time Database vs. Broadcast Trade-offs**: Relational databases quickly saturate under high-frequency writes (e.g. hundreds of simultaneous emoji reactions). Ephemeral WebSocket broadcast channels offload database I/O while preserving a 60fps viewer experience.
  3. **Optimistic UI Synchronization**: Managing optimistic local state updates alongside asynchronous server broadcasts and database persistence ensures an instantaneous user interface while handling network rollbacks gracefully.

---

## 9. Demo Accounts

| Name | Account (Email) | Password | Role |
| :--- | :--- | :--- | :--- |
| **Jessica** | `mp5459544@gmail.com` | `111111` | **Seller** |
| **Siddhant Patel** | `bxivfk0171@minitts.net` | `111111` | **Customer** |
| **Sandhya** | `spindia191@gmail.com` | `123@abc` | **Customer** |
| **David** | `ovfgeo2994@minitts.net` | `111111` | **Seller** |
| **Minitts** | `ajqnol1993@minitts.net` | `111111` | **Customer** |

*(You can also create fresh seller and customer accounts directly via the `/signup` screen).*

