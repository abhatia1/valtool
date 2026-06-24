# Valtool

A production-grade MLOps platform for automated machine learning with comprehensive experiment tracking, visualization, and monitoring. Valtool guides you through a structured 6-stage workflow for classification, regression, and time series tasks.

## Features

- **6-stage AutoML workflow**: Upload → EDA → Configure → Train → Test → Monitor
- **Automated EDA**: Summary statistics, univariate/bivariate analysis, correlation, outlier detection, and data-quality insights with interactive Plotly visualizations
- **Multi-model training**: 15+ classification and 20+ regression estimators (Logistic Regression, Random Forest, XGBoost, SVM, KNN, MLP, and more), plus time series support
- **Configurable pipelines**: Scaling, imputation, encoding, feature engineering, and hyperparameter tuning (grid / random / Bayesian search) via reusable templates
- **Rich visualizations**: Confusion matrices, ROC/PR curves, feature importance, predicted-vs-actual and residual plots
- **Monitoring**: Data drift detection (PSI, KS test, Jensen-Shannon divergence), performance logging, and alerting
- **Experiment tracking**: Optional MLflow integration for runs, metrics, and model registry

## Tech Stack

- **Backend**: FastAPI (Python 3.9+), SQLAlchemy, scikit-learn, XGBoost, statsmodels, SHAP, MLflow
- **Frontend**: Next.js (React, TypeScript), shadcn/ui, Tailwind CSS
- **Database**: SQLite (development), PostgreSQL-ready for production
- **Visualization**: Plotly (backend-generated JSON, rendered with react-plotly.js)

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+

### Setup

```bash
# First-time setup (creates venv, installs deps, initializes DB)
./setup.sh

# Start both backend and frontend
./start.sh
```

Manual setup if the scripts fail:

```bash
# Backend
cd be
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 -c "from core.database import engine, Base; Base.metadata.create_all(bind=engine)"

# Frontend
cd fe
npm install
```

### Running

```bash
# Backend (http://localhost:8000, API docs at /docs)
cd be
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Frontend (http://localhost:3000)
cd fe
npm run dev
```

## Configuration

**Backend** (`be/.env`):

```env
DATABASE_URL=sqlite:///./valtool.db
MLFLOW_TRACKING_URI=http://localhost:5000
STORAGE_PATH=./storage
```

**Frontend** (`fe/.env.local`):

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Project Structure

```
valtool/
├── be/                 # Backend (FastAPI)
│   ├── api/            # REST endpoints (upload, eda, configuration, training)
│   ├── services/       # Business logic & ML pipelines
│   ├── models/         # SQLAlchemy ORM models + Pydantic schemas
│   ├── core/           # App config, database, dependencies
│   ├── utils/          # File handling & validation helpers
│   ├── config/         # YAML templates & estimator registry
│   └── main.py         # FastAPI entry point
├── fe/                 # Frontend (Next.js)
│   ├── app/            # App Router pages
│   ├── components/     # React components (stages, UI, charts)
│   ├── lib/            # API clients & utilities
│   └── types/          # TypeScript type definitions
├── setup.sh            # Initial setup script
└── start.sh            # Start backend & frontend
```

## Workflow

1. **Upload** — Dataset upload, validation, and type detection
2. **EDA** — Exploratory data analysis with interactive visualizations
3. **Configure** — Training configuration via templates (Quick Start, Standard, Deep Search)
4. **Train** — AutoML training across multiple models with hyperparameter tuning
5. **Test** — Model evaluation on new datasets
6. **Monitor** — Drift detection and performance tracking

## MLflow (optional)

Experiment tracking is disabled by default. To enable, start an MLflow server and configure tracking:

```bash
cd be
source venv/bin/activate
mlflow server --host 0.0.0.0 --port 5000   # UI at http://localhost:5000
```

## License

See repository for license details.
