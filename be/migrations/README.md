# Database Migrations

This folder contains database migration scripts for the Valtool backend.

## Running Migrations

### Add dimensionality_reduction column

This migration adds support for dimensionality reduction analysis (PCA, t-SNE) in EDA reports.

```bash
# From the project root directory
cd be
python migrations/add_dimensionality_reduction_column.py
```

### Rollback (if needed)

```bash
cd be
python migrations/add_dimensionality_reduction_column.py downgrade
```

## Alternative: Reset Database

If you're in development and don't mind losing data, you can reset the entire database:

```bash
cd be
python -c "from core.database import reset_db; reset_db()"
```

This will drop all tables and recreate them with the latest schema.
