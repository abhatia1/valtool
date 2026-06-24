"""
Migration: Add dimensionality_reduction column to eda_reports table

This migration adds the dimensionality_reduction column to the eda_reports table
to support comprehensive dimensionality reduction analysis (PCA, t-SNE, etc.).

Usage:
    python be/migrations/add_dimensionality_reduction_column.py
"""

from sqlalchemy import create_engine, text, inspect
from core.config import settings


def upgrade():
    """Add dimensionality_reduction column to eda_reports table"""
    engine = create_engine(settings.DATABASE_URL)

    # Check if column already exists
    inspector = inspect(engine)
    columns = [col['name'] for col in inspector.get_columns('eda_reports')]

    if 'dimensionality_reduction' in columns:
        print("✓ Column 'dimensionality_reduction' already exists in eda_reports table")
        return

    # Add the column
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE eda_reports ADD COLUMN dimensionality_reduction JSON"
        ))
        conn.commit()

    print("✓ Successfully added 'dimensionality_reduction' column to eda_reports table")


def downgrade():
    """Remove dimensionality_reduction column from eda_reports table"""
    engine = create_engine(settings.DATABASE_URL)

    # Check if column exists
    inspector = inspect(engine)
    columns = [col['name'] for col in inspector.get_columns('eda_reports')]

    if 'dimensionality_reduction' not in columns:
        print("✓ Column 'dimensionality_reduction' does not exist in eda_reports table")
        return

    # Remove the column
    with engine.connect() as conn:
        # SQLite doesn't support DROP COLUMN directly, need to recreate table
        # For other databases, use: ALTER TABLE eda_reports DROP COLUMN dimensionality_reduction
        if 'sqlite' in settings.DATABASE_URL:
            print("⚠ SQLite doesn't support DROP COLUMN. Manual intervention required.")
            print("  Consider recreating the database with: python be/migrations/reset_db.py")
        else:
            conn.execute(text(
                "ALTER TABLE eda_reports DROP COLUMN dimensionality_reduction"
            ))
            conn.commit()
            print("✓ Successfully removed 'dimensionality_reduction' column from eda_reports table")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
