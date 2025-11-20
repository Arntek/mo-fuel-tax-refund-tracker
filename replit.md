# Gas Receipt Tax Refund Application

## Overview

This is a web application for managing gas station receipts for Missouri Form 4923-H tax refund filing. The application enables users to upload receipt images (via camera or file upload), automatically transcribe receipt data using AI, manage receipts in a data table, and export data for tax filing purposes. The application tracks receipts by fiscal year and provides deadline reminders during the submission window (July 1 - September 30).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using Vite as the build tool and development server.

**UI Component Library**: Shadcn UI components built on Radix UI primitives, styled with Tailwind CSS. The design follows Fluent Design principles with a focus on data clarity and professional appearance suitable for financial/tax applications.

**Routing**: Wouter for lightweight client-side routing.

**State Management**: TanStack Query (React Query) for server state management, with optimistic updates and automatic refetching disabled (staleTime: Infinity) to prevent unnecessary re-renders.

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

**Schema Design**: Single `receipts` table with:
- UUID primary key (auto-generated)
- Image URL (text, not null)
- Transaction metadata (date, station name, gallons, price per gallon, total amount)
- Fiscal year tracking (text, not null)
- Timestamp tracking (created_at)

**Rationale**: In-memory storage enables rapid prototyping without database setup. Drizzle ORM provides type-safe database queries with excellent TypeScript integration. PostgreSQL offers robust relational data management suitable for financial records.

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