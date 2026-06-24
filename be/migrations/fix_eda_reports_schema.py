"""
Migration: Fix EDA Reports table schema

Adds all missing columns to the eda_reports table to match the current model.

Run this script to update your database schema.
"""

import sqlite3
import sys
from pathlib import Path

# Add parent directory to path to import database module
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.config import settings


def run_migration():
    """Add all missing columns to eda_reports table"""
    # Extract database file path from DATABASE_URL
    db_path = settings.DATABASE_URL.replace('sqlite:///', '')

    print(f"Connecting to database: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check existing columns
        cursor.execute("PRAGMA table_info(eda_reports)")
        existing_columns = {row[1] for row in cursor.fetchall()}

        # Define all columns that should exist
        columns_to_add = [
            ('target_column', 'VARCHAR(255)'),
            ('target_insights', 'JSON'),
            ('missing_data_patterns', 'JSON'),
            ('data_quality_flags', 'JSON'),
            ('feature_engineering_suggestions', 'JSON'),
            ('class_imbalance_analysis', 'JSON'),
            ('target_leakage_detection', 'JSON'),
            ('multivariate_outliers', 'JSON'),
            ('feature_importance', 'JSON'),
            ('detailed_univariate_analysis', 'JSON'),
            ('multivariate_analysis', 'JSON'),
        ]

        for column_name, column_type in columns_to_add:
            if column_name not in existing_columns:
                print(f"Adding column: {column_name} ({column_type})")
                cursor.execute(f"""
                    ALTER TABLE eda_reports
                    ADD COLUMN {column_name} {column_type}
                """)
                print(f"✓ Successfully added {column_name}")
            else:
                print(f"⊘ Column {column_name} already exists, skipping")

        conn.commit()
        print("\n✓ Migration completed successfully!")

        # Show final schema
        print("\nFinal eda_reports schema:")
        cursor.execute("PRAGMA table_info(eda_reports)")
        for row in cursor.fetchall():
            print(f"  {row[1]} ({row[2]})")

    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        conn.rollback()
        raise

    finally:
        conn.close()


if __name__ == "__main__":
    print("=" * 60)
    print("EDA Reports Schema Fix Migration")
    print("=" * 60)
    run_migration()
