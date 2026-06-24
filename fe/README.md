# AutoML Platform - Frontend

A production-grade frontend for the AutoML platform, built with Next.js 16, TypeScript, and Tailwind CSS.

## Design Philosophy

This frontend features a **data-editorial aesthetic** inspired by scientific publications and modern data visualization platforms:

- **Typography**: IBM Plex Sans for body text, Fraunces for display headings, IBM Plex Mono for data
- **Color Palette**: Deep indigo primary, teal accents, and a data viz-inspired chart palette
- **Motion**: Purposeful animations with staggered reveals and micro-interactions
- **Layout**: Clean, spacious layouts with asymmetric elements and generous whitespace

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
- **Charts**: Recharts
- **HTTP Client**: Axios
- **Date Formatting**: date-fns

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Backend API running on `http://localhost:8000`

### Installation

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` if your backend is running on a different URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

3. Run the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Architecture: Single-Page Orchestrator

This application follows a **single-page workflow orchestrator pattern** where all stages are managed from one page:

```
AutoMLWorkflow (Orchestrator)
├── Stage 1: Upload Dataset
├── Stage 2: EDA (Exploratory Data Analysis)
├── Stage 3: Configure Training (Coming in Phase 3)
├── Stage 4: Model Training (Coming in Phase 4)
├── Stage 5: Testing (Coming in Phase 5)
└── Stage 6: Monitoring (Coming in Phase 5)
```

All components are embedded in a single page with stage navigation, rather than separate routes.

## Phase 1: Dataset Upload & EDA (Current)

### Features Implemented

✅ **Workflow Orchestrator**
- Single-page application with stage navigation
- Visual progress indicator
- Stage-to-stage transitions
- State management across workflow

✅ **Stage 1: Dataset Upload**
- Drag-and-drop CSV file upload
- File validation (type, size)
- Real-time upload progress
- Success confirmation with metadata
- Auto-advance to EDA on success

✅ **Stage 2: EDA (Exploratory Data Analysis)**
- Dataset metadata display
- Column type distribution
- Data quality metrics
- Missing value analysis
- Interactive data preview (first 10 rows)
- Click columns for detailed statistics

✅ **Column Statistics Modal**
- Numeric: mean, std, min, max, median, quartiles
- Categorical: unique count, distribution charts
- Missing value percentage
- Interactive visualizations with Recharts

### Main Components

**Orchestrator:**
- `AutoMLWorkflow.tsx` - Main workflow orchestrator with stage navigation

**Stage Components** (in `/components/stages/`):
- `EDAStage.tsx` - Stage 2: Exploratory Data Analysis
- `ConfigureStage.tsx` - Stage 3: Configure Training (Phase 3)
- `TrainingStage.tsx` - Stage 4: Model Training (Phase 4)
- `TestingStage.tsx` - Stage 5: Testing (Phase 5)
- `MonitoringStage.tsx` - Stage 6: Monitoring (Phase 5)

**Shared Components:**
- `DatasetUpload.tsx` - Stage 1: File upload with drag-and-drop
- `DatasetDetails.tsx` - Dataset overview with tabs
- `DatasetPreview.tsx` - Data table preview
- `ColumnStats.tsx` - Modal for detailed column statistics
- `DatasetList.tsx` - Utility component

### API Integration

API client located in `/lib/api/datasets.ts` with methods:
- `upload()` - Upload CSV dataset
- `list()` - List all datasets
- `getDetails()` - Get dataset metadata
- `preview()` - Preview dataset rows
- `getColumnStats()` - Get column statistics
- `delete()` - Delete dataset

Error handling in `/lib/api/errorHandler.ts`.

## Project Structure

```
fe/
├── app/
│   ├── globals.css         # Global styles + theme
│   ├── layout.tsx          # Root layout with fonts
│   └── page.tsx            # Main page with AutoMLWorkflow orchestrator
├── components/
│   ├── ui/                 # shadcn/ui components (14 components)
│   ├── stages/             # Stage-specific components
│   │   ├── EDAStage.tsx           # Stage 2: EDA
│   │   ├── ConfigureStage.tsx     # Stage 3: Configure (Phase 3)
│   │   ├── TrainingStage.tsx      # Stage 4: Training (Phase 4)
│   │   ├── TestingStage.tsx       # Stage 5: Testing (Phase 5)
│   │   └── MonitoringStage.tsx    # Stage 6: Monitoring (Phase 5)
│   ├── AutoMLWorkflow.tsx  # Main orchestrator
│   ├── DatasetUpload.tsx   # Stage 1: Upload (shared)
│   ├── DatasetDetails.tsx  # Shared component
│   ├── DatasetPreview.tsx  # Shared component
│   ├── ColumnStats.tsx     # Shared modal
│   └── DatasetList.tsx     # Utility component
├── lib/
│   ├── api/
│   │   ├── datasets.ts     # API client
│   │   └── errorHandler.ts # Error handling
│   └── utils.ts            # Utilities
└── types/
    └── dataset.ts          # TypeScript types
```

## Development Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Theming

The app uses CSS custom properties for theming. Edit `/app/globals.css` to customize:

- Primary colors (indigo, teal)
- Chart colors (5-color data viz palette)
- Typography scale
- Border radius
- Spacing

## Next Steps (Phase 2)

Phase 2 will add:
- EDA (Exploratory Data Analysis) generation
- Plotly visualizations
- Correlation matrices
- Automated insights
- Export functionality

See `docs/fe/phase-2-eda-integration.md` for details.

## Contributing

Follow the existing patterns:
- Use TypeScript strictly
- Follow the data-editorial design system
- Keep components focused and composable
- Use shadcn/ui components when possible
- Add proper error handling
- Include loading states

## License

MIT
