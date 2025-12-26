# Gas Receipt Tax Refund Application

## Overview

This is a multi-tenant web application for managing gas station receipts for Missouri Form 4923-H tax refund filing. The application features email-based magic code authentication, account sharing with role management (owner/admin/member), vehicle tracking with VIN lookup and nicknames, and comprehensive tax form data collection. Users can upload receipt images (via camera or file upload), automatically transcribe receipt data using AI, manage receipts in a paginated data table, and export data for tax filing purposes. The application tracks receipts by fiscal year and provides deadline reminders during the submission window (July 1 - September 30).

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (December 26, 2025)

### Security Enhancements
- **Receipt Image Access Control**: `/objects` endpoint now requires authentication and enforces role-based access - members can only download images for receipts they uploaded or for assigned vehicles
- **Receipt CRUD Access Control**: PUT/DELETE receipt routes verify ownership - members can only modify their own receipts
- **Vehicle Access Control**: Vehicle by ID endpoint checks membership assignment for member role users
- **Data Encryption at Rest**: Added `server/encryption.ts` with AES-256-GCM encryption:
  - SSNs encrypted with random IV for maximum security
  - VINs encrypted with random IV plus HMAC-SHA256 search hash for secure lookups
  - Requires `ENCRYPTION_KEY` environment variable in production (32+ characters)
  - Utility functions for masking SSNs (XXX-XX-1234 format)

---

## Previous Changes (November 22, 2025)

### Vehicle Management Enhancements
- **Vehicle Nicknames**: Added optional nickname field to vehicles for user-friendly identification (e.g., "Mom's Truck" instead of "2015 Ford F-150")
- **Vehicle Edit Page**: Created dedicated edit page at `/vehicles/:accountId/edit/:vehicleId` for updating vehicle nicknames (no modals per user preference)
- **Enhanced Vehicle Display**: Vehicle cards now show nickname with year/make/model in parentheses, plus always display fuel type, weight class, and VIN

### Member Management Improvements  
- **Soft Deletion**: Members are now deactivated (marked inactive) rather than deleted, preserving user data and receipt submissions across accounts
- **Active Status Filtering**: Account member lists automatically filter to show only active members
- **Inline Role Editing**: Added Select dropdowns for changing member roles (admin/member) directly in the people management page without navigation

### Receipts Table Enhancements
- **Pagination**: Added pagination controls with 10/25/50 items per page options, default 10
- **Persistent Preferences**: Page size preference saved to localStorage with SSR-safe guards
- **Auto-reset**: Pagination resets to page 1 when data changes or page size is adjusted

### Technical Improvements
- **UUID Identifiers**: All IDs use UUID strings throughout (accounts, users, vehicles, receipts, members) for better scalability and security
- **Type Safety**: Replaced `any` types with proper schema exports (Account, Vehicle, AccountMember, User) for compile-time safety
- **SSR Compatibility**: localStorage access guarded with function-form useState initializers to prevent server-side rendering crashes

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using Vite as the build tool and development server.

**UI Component Library**: Shadcn UI components built on Radix UI primitives, styled with Tailwind CSS. The design follows Fluent Design principles with a focus on data clarity and professional appearance suitable for financial/tax applications.

**Routing**: Wouter for lightweight client-side routing. All editing functionality uses dedicated routes and pages (no modals per user preference). Key routes include:
- `/receipts/:accountId` - Receipt management with pagination
- `/vehicles/:accountId` - Vehicle listing
- `/vehicles/:accountId/edit/:vehicleId` - Vehicle nickname editing
- `/people/:accountId` - Member management with inline role editing

**State Management**: TanStack Query (React Query) for server state management, with optimistic updates and automatic refetching disabled (staleTime: Infinity) to prevent unnecessary re-renders. Query cache invalidation ensures UI updates after mutations.

**Form Handling**: React Hook Form with Zod validation for type-safe form schemas.

**Design System**: Custom theme system with light/dark mode support, using CSS variables for theming. Typography uses Inter font family from Google Fonts. The color palette is based on neutral tones with a primary blue accent (HSL: 217 91% 45%).

**Rationale**: This stack provides a modern, type-safe development experience with excellent developer ergonomics. Shadcn UI offers pre-built accessible components that can be customized, while Tailwind CSS enables rapid styling with consistent spacing and colors. TanStack Query simplifies data fetching and caching logic.

### Backend Architecture

**Framework**: Express.js running on Node.js with TypeScript (ESM modules).

**API Design**: RESTful HTTP endpoints under `/api` prefix:
- `GET /api/receipts` - Fetch all receipts
- `POST /api/receipts/upload` - Upload receipt image with multipart/form-data
- `PUT /api/receipts/:id` - Update receipt data
- `DELETE /api/receipts/:id` - Delete receipt

**File Upload**: Multer middleware for handling multipart form data with 10MB file size limit and in-memory storage.

**Data Storage**: In-memory storage (`MemStorage` class) with Drizzle ORM schema definitions ready for PostgreSQL migration. The schema includes a `receipts` table with fields for image URL, transaction details (date, station name, gallons, price per gallon, total amount), fiscal year, and timestamps.

**Development Server**: Vite middleware integrated with Express for hot module replacement during development. Production builds serve static files from `dist/public`.

**Rationale**: Express provides a minimal, flexible foundation for the API layer. The in-memory storage allows rapid development and testing, with a clear migration path to PostgreSQL via Drizzle ORM. Multer is the standard solution for file uploads in Express applications.

### Data Storage Solutions

**Current Implementation**: In-memory Map-based storage (non-persistent) via `MemStorage` class.

**Planned Database**: PostgreSQL with Drizzle ORM, as evidenced by:
- `drizzle.config.ts` configured for PostgreSQL dialect
- Schema defined in `shared/schema.ts` using Drizzle's `pgTable`
- `@neondatabase/serverless` dependency for serverless PostgreSQL connections
- Migration directory configured at `./migrations`

**Schema Design**: Multi-tenant architecture with UUID-based identifiers:
- **users**: User accounts with email-based authentication (UUID primary key)
- **accounts**: Tax filing accounts with owner and tax form fields (UUID primary key)
- **accountMembers**: Many-to-many relationship with role (owner/admin/member) and active status for soft deletion
- **vehicles**: Per-account vehicles with optional nickname, VIN, year/make/model, fuel type, weight class (UUID primary key)
- **receipts**: Transaction records with image URL, transcribed data, fiscal year, linked to account and vehicle (UUID primary key)
- **sessions**: Authentication sessions with expiry tracking
- **authCodes**: Magic code storage for email-based login

**Member Lifecycle**: Members use active/inactive status rather than hard deletion. When deactivated from an account, they remain in the system for other accounts they belong to and retain ownership of their receipt submissions.

**Multi-Tenant Isolation**: Receipts stored in object storage at `.private/{accountId}/receipts/{uuid}` for proper data separation between accounts.

**Rationale**: In-memory storage enables rapid prototyping without database setup. Drizzle ORM provides type-safe database queries with excellent TypeScript integration. PostgreSQL offers robust relational data management suitable for financial records. UUID identifiers provide better scalability and security than auto-increment integers.

## External Dependencies

### Cloud Storage

**Service**: Google Cloud Storage via `@google-cloud/storage` SDK

**Purpose**: Persistent storage for uploaded receipt images

**Authentication**: Replit Sidecar service (`http://127.0.0.1:1106`) provides credential exchange for Google Cloud Platform access using external account authentication with access tokens.

**Access Control**: Custom ACL (Access Control List) system defined in `server/objectAcl.ts` with object-level permissions (READ/WRITE), ownership tracking, and public/private visibility settings.

**Upload Flow**: 
1. Client uploads file via multipart form
2. Server obtains signed upload URL from object storage service
3. Server uploads file buffer to GCS
4. Public URL returned and stored in database

**Rationale**: GCS provides reliable, scalable object storage with global availability. The Replit Sidecar service simplifies authentication without managing API keys.

### AI Integration

**Service**: OpenAI GPT-4o via Replit's AI Integrations service

**Purpose**: Automatic transcription of receipt images to extract structured data (date, station name, gallons, price per gallon, total amount)

**API Configuration**: 
- Base URL: `process.env.AI_INTEGRATIONS_OPENAI_BASE_URL`
- API Key: `process.env.AI_INTEGRATIONS_OPENAI_API_KEY`
- Model: `gpt-4o` (optimized for vision tasks)
- Response format: JSON object with structured fields

**Prompt Strategy**: Vision + text prompt requesting specific fields in JSON format. The AI is instructed to estimate missing fields rather than return null values.

**Validation**: Zod schema (`aiTranscriptionSchema`) validates AI responses before database insertion.

**Rationale**: GPT-4o provides state-of-the-art vision capabilities for OCR and structured data extraction. Using Replit's AI Integrations service eliminates the need for separate OpenAI API key management. JSON mode ensures consistent, parseable responses.

### UI Component Libraries

**Radix UI**: Unstyled, accessible component primitives for dialogs, dropdowns, toasts, forms, and more (20+ components imported)

**Lucide React**: Icon library for consistent iconography throughout the application

**Rationale**: Radix UI provides production-ready accessibility features (ARIA attributes, keyboard navigation, focus management) without imposing design opinions. Lucide offers a comprehensive, tree-shakeable icon set.

### Development Tools

**Replit Integrations** (development only):
- `@replit/vite-plugin-runtime-error-modal` - Runtime error overlay
- `@replit/vite-plugin-cartographer` - Code navigation
- `@replit/vite-plugin-dev-banner` - Development environment indicator

**Rationale**: These plugins enhance the Replit development experience without affecting production builds.