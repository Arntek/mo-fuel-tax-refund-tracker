# Design Guidelines: Gas Receipt Tax Refund Application

## Design Approach

**System**: Clean, professional design inspired by **Fluent Design** principles for data-intensive applications, with influences from modern financial/tax software like TurboTax and Experian for trustworthy, form-focused experiences.

**Rationale**: This is a utility-focused tax compliance tool where clarity, efficiency, and data accuracy are paramount. Users need to quickly capture receipts, review transcribed data, and manage fiscal year records.

## Core Design Principles

1. **Data First**: Information hierarchy prioritizes receipt details, amounts, and dates
2. **Trust & Accuracy**: Professional appearance befitting financial/tax data handling
3. **Mobile-Optimized**: Camera capture requires excellent mobile UX
4. **Scannable Content**: Tables and summaries must be easily readable

## Typography

- **Primary Font**: Inter or System UI fonts via Google Fonts
- **Hierarchy**:
  - Page titles: text-2xl to text-3xl, font-semibold
  - Section headers: text-xl, font-semibold
  - Data labels: text-sm, font-medium, uppercase tracking-wide
  - Body/data: text-base
  - Helper text: text-sm, reduced opacity

## Layout System

**Spacing**: Use Tailwind units of **2, 4, 6, 8, 12, 16** for consistent rhythm
- Component padding: p-4 to p-6
- Section gaps: gap-6 to gap-8
- Page margins: px-4 md:px-8

**Container**: max-w-7xl mx-auto for main content

## Component Library

### Navigation
- Top navigation bar with app title and fiscal year indicator
- Mobile: Hamburger menu with clear icon
- Include deadline reminder banner when in submission window (July 1-Sept 30)

### Receipt Upload Zone
- Large dropzone area (min-height: 200px on desktop, 150px mobile)
- Dashed border (border-2 border-dashed)
- Camera icon and clear "Upload Receipt" or "Take Photo" text
- Mobile: Prominent camera button for native camera access
- Shows upload progress indicator

### Receipt Data Table
- Responsive table with horizontal scroll on mobile
- Columns: Thumbnail preview | Date | Station | Gallons | Price/Gal | Total | Actions
- Row hover states for better scanning
- Thumbnail images: 60x60px with rounded corners
- Sticky header on scroll
- Sort indicators on column headers
- Delete/edit actions as icon buttons

### Receipt Card (Mobile Alternative)
- When viewport < md, switch to card layout
- Each receipt as a card with thumbnail, key details stacked
- Expand/collapse for full details

### Dashboard Summary Cards
- Grid of 2-3 cards showing:
  - Total gallons (current fiscal year)
  - Total amount spent
  - Number of receipts
  - Days until submission deadline (if applicable)
- Each card: p-6, rounded-lg, with large number (text-3xl font-bold) and label

### Data Export Section
- Clear "Export to CSV" button (large, primary style)
- Fiscal year selector dropdown
- Export includes instruction text about Form 4923-H

### Receipt Detail Modal
- Full-screen on mobile, centered modal on desktop
- Shows full receipt image
- Editable fields for AI-extracted data
- Save/Cancel actions prominently placed

### Empty States
- When no receipts: Large icon, encouraging message, upload CTA
- Clear visual guidance for first-time users

## Form Inputs
- Text inputs: border, rounded, p-3, focus ring
- Date pickers: Native input with calendar icon
- Dropdowns: Standard select with chevron indicator
- All inputs have clear labels above (text-sm font-medium)

## Buttons
- Primary: Solid fill, rounded, px-4 py-2, font-medium
- Secondary: Border style with transparent background
- Icon buttons: Square, p-2, icon centered
- Large CTAs for upload: px-6 py-3

## Animations
**Minimal use**:
- Subtle fade-in for receipt cards after upload
- Smooth transitions on table sort (200ms)
- Loading spinners during AI transcription
- No elaborate scroll animations

## Images
**Receipt Thumbnails**: 
- Grid/table view: 60x60px rounded thumbnails
- Detail view: Full-width image, max-height constrained for readability
- Lazy loading for performance

**Icons**: Heroicons via CDN for upload, camera, calendar, export, trash icons

## Responsive Breakpoints
- Mobile-first approach
- md: (768px) - Switch from cards to table layout
- lg: (1024px) - Multi-column dashboard summary

## Accessibility
- All images have alt text describing receipt details
- Form inputs have associated labels
- Focus states clearly visible
- Keyboard navigation for table rows and modals
- ARIA labels for icon-only buttons