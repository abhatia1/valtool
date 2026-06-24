"""
Migration: Add advanced EDA analysis fields

Adds feature_importance, detailed_univariate_analysis, and multivariate_analysis
columns to the eda_reports table.

Run this script once to update your database schema.
"""

import sqlite3
import sys
from pathlib import Path

# Add parent directory to path to import database module
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.config import settings


def run_migration():
    """Add new columns to eda_reports table"""
    # Extract database file path from DATABASE_URL
    # Format: sqlite:///path/to/file.db
    db_path = settings.DATABASE_URL.replace('sqlite:///', '')

    print(f"Connecting to database: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(eda_reports)")
        existing_columns = {row[1] for row in cursor.fetchall()}

        columns_to_add = [
            'feature_importance',
            'detailed_univariate_analysis',
            'multivariate_analysis'
        ]

        for column_name in columns_to_add:
            if column_name not in existing_columns:
                print(f"Adding column: {column_name}")
                cursor.execute(f"""
                    ALTER TABLE eda_reports
                    ADD COLUMN {column_name} JSON
                """)
                print(f"✓ Successfully added {column_name}")
            else:
                print(f"⊘ Column {column_name} already exists, skipping")

        conn.commit()
        print("\n✓ Migration completed successfully!")

    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        conn.rollback()
        raise

    finally:
        conn.close()


if __name__ == "__main__":
    print("=" * 60)
    print("EDA Advanced Fields Migration")
    print("=" * 60)
    run_migration()
