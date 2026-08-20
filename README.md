# Reneo Live — Full-Stack Live Commerce Platform

A live-commerce platform slice built for solo entrepreneurs. A seller goes live to showcase a product, while customers can join the stream, watch in real-time with ultra-low latency, chat with the seller and other viewers, inspect detailed product specifications, and manage their cart—all without leaving or interrupting the live broadcast.

---

## 1. Tech Stack

- **Frontend**: React 18, TypeScript, Vite, React Router DOM, Agora RTC SDK (`agora-rtc-sdk-ng`), Supabase JS Client (`@supabase/supabase-js`).
- **Backend**: Node.js, Express, TypeScript, Agora Access Token SDK (`agora-access-token`), Supabase Client.
- **Database & Cloud Services (Supabase)**:
  - **Auth**: Email/password authentication with role metadata (`seller` vs `customer`).
  - **Database (PostgreSQL)**: Relational schema with Row Level Security (RLS) policies.
  - **Storage**: `product-images` bucket for product media.
  - **Realtime**: Postgres Changes subscriptions for chat and stream lifecycle, plus Supabase Presence for live viewer tracking.
- **Live Video (Agora RTC)**: Server-side token generation, enforcing `publisher` (host) vs `subscriber` (audience) permissions.

---

## 2. Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT LAYER                                      |
|  +-----------------------------------------------------------------------------+  |
|  |                            React + TypeScript (Vite)                        |  |
|  |  - Seller Flow: Create Product -> Go Live -> Host Controls (Mic, Cam, End)  |  |
|  |  - Customer Flow: Discovery -> Join Live -> In-stream Product & Cart & Chat |  |
|  +--------------------------------------+--------------------------------------+  |
+-----------------------------------------|-----------------------------------------+
                                          |
                +-------------------------+-------------------------+
                |                                                   |
                v (HTTPS / REST)                                    v (WebSockets / REST)
+-------------------------------+                  +--------------------------------+
|       BACKEND API (Express)   |                  |     SUPABASE CLOUD PLATFORM    |
|  - JWT Auth Middleware        |                  |  - Auth: Users & Profiles      |
|  - Ownership Validation       |                  |  - PostgreSQL with RLS         |
|  - Start / End Live Lifecycle |                  |  - Storage: product-images     |
|  - Server Agora Token Builder |                  |  - Realtime: Chat & Presence   |
+---------------+---------------+                  +--------------------------------+
                |
                v (RTC Token)
+-------------------------------+
|         AGORA RTC SD-RTN      |
|  - Host: Publishes A/V Tracks |
|  - Audience: Subscribes Only  |
+-------------------------------+
```

---

## 3. Getting Started & Setup

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
2. Run the SQL script from [`supabase/schema.sql`](supabase/schema.sql). This creates the tables (`profiles`, `products`, `live_sessions`, `live_messages`, `cart_items`), the profile creation trigger, and all RLS policies.
3. Go to **Storage** -> Create a new public bucket named `product-images` (if not created by script).

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

### 4. Running Locally
```bash
# Start backend (from backend directory)
npm run dev

# Start frontend in another terminal (from frontend directory)
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 4. Key Technical Decisions & Justifications

### A. Non-Disruptive Product Inspection (A6)
- **Design Choice**: In-stream Product Modal / Drawer.
- **Justification**: In live-commerce, customer engagement drops dramatically if navigating away breaks or pauses the video stream. By rendering an interactive modal overlay over the active video container, the Agora media track and WebRTC connection continue running seamlessly without unmounting, re-buffering, or losing chat context.

### B. Deliberate Host vs. Audience Agora Roles (A5 & A10)
- **Design Choice**: Server-side role resolution and token issuance (`POST /api/agora/token`).
- **Justification**: The frontend never holds the Agora App Certificate. When joining a channel, the backend inspects the authenticated Supabase user session and checks whether the user is the assigned host of that live session. Only the verified host receives a `publisher` token. Customers receive `subscriber` tokens and cannot publish media tracks to the channel.

### C. Real-Time Chat & Viewer Presence (A7 & Part B)
- **Design Choice**: Supabase Realtime (PostgreSQL Changes) for chat messages, and Supabase Presence for live viewer tracking.
- **Justification**: PostgreSQL Changes guarantees that messages are persisted with referential integrity to `profiles` and `live_sessions` before broadcast. Timestamps are formatted per user locale, and the chat container auto-scrolls down when new messages arrive.

---

## 5. Security & Access Control (A10)

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

---

## 6. Comprehensive Error Handling (A11)

The application handles edge cases with clear, actionable user messages:
- **Camera/Microphone Permission Denied**: Explicit alert instructing the user to enable browser permissions.
- **No Secondary Camera Found**: Informs the seller if their device lacks multiple camera inputs.
- **Live Stream Ended**: Automatically closes Agora tracks and presents an informative banner allowing the customer to continue viewing the product and cart.
- **Agora Connection Failure / Interruption**: Catches network interruptions and offers retry/reconnection indicators.
- **Invalid Session / Token Expiry**: Redirects to authentication with clear feedback.

---

## 7. Part C — Written Questions

### 1. Which part of this would break first if 500 customers joined the same live? What would you change?
- **The Bottleneck**: Supabase Realtime chat fan-out and Presence synchronization would encounter heavy pressure before Agora's media infrastructure (since Agora is architected for massive WebRTC broadcast distribution). If 500 viewers rapidly send chat messages and join/leave presence states, subscribing to raw Postgres changes on every row insert can saturate client-side rendering and database replication streams.
- **What I Would Change**:
  1. **Chat Fan-out**: Switch from direct database change broadcast to Supabase Broadcast channels or a Redis Pub/Sub WebSocket cluster, persisting messages in background batches.
  2. **Presence Throttling**: Throttle presence heartbeat syncs and aggregate viewer counts server-side (e.g., periodic Redis count increment) rather than full state synchronization to every connected client.
  3. **Frontend Message Virtualization**: Use message windowing/virtualization so the DOM does not degrade when thousands of messages accumulate.

### 2. What did you not have time to do, and what would you do next with two more days?
1. **Multi-Product Switching in Live Streams (Part B)**: Allow the seller to pin and switch between multiple featured products in real-time during a single broadcast.
2. **Emoji Reactions / Floating Hearts (Part B)**: Implement lightweight floating emoji animations over the live video stream using Supabase Broadcast channels.
3. **Automated E2E & Integration Tests**: Write Vitest/Playwright tests verifying RLS policy boundaries, token issuance restrictions, and cart operations.
4. **Payment Gateway Integration**: Integrate Stripe / Paystack checkout flow to turn cart items into completed orders.

### 3. Where did you use a library or an AI assistant to do something you would not have been able to write yourself, and what did you learn afterwards?
- **Usage**: I leveraged the `agora-access-token` package and AI assistance to properly configure the `RtcTokenBuilder` privilege bitmasks and map user IDs to Agora integer UIDs safely.
- **What I Learned**: WebRTC platforms like Agora use numerical UIDs (or specific byte encodings) for media channels and separate publisher and subscriber privileges at the cryptographic token layer. Enforcing security requires generating tokens with strict role-based expiration on the backend rather than allowing clients to join channels with open access.

---

## 8. Demo Accounts

| Role | Email | Password |
| :--- | :--- | :--- |
| **Seller** | `seller@reneo.demo` | `Password123!` |
| **Customer** | `customer@reneo.demo` | `Password123!` |

*(You can also create fresh seller and customer accounts directly via the `/signup` screen).*
