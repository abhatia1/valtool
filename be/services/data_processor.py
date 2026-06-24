"""
Data Processing Service

Handles dataset upload, validation, and preprocessing operations.
"""

import pandas as pd
from pathlib import Path
from typing import Dict, Tuple, Optional
from sqlalchemy.orm import Session
from fastapi import UploadFile, HTTPException

from models.database import Dataset
from utils.file_utils import (
    generate_dataset_id,
    get_dataset_storage_path,
    save_upload_file,
    sanitize_filename,
    is_allowed_extension,
    delete_dataset_files,
)
from utils.validation import (
    validate_csv_file,
    analyze_column_types,
    count_missing_values,
    get_data_summary,
    check_file_size,
)
from core.config import settings


class DataProcessor:
    """Service for processing uploaded datasets"""

    @staticmethod
    async def process_upload(
        file: UploadFile,
        name: str,
        description: Optional[str],
        db: Session
    ) -> Dataset:
        """
        Process an uploaded dataset file.

        Args:
            file: Uploaded file object
            name: Dataset name
            description: Optional dataset description
            db: Database session

        Returns:
            Dataset: Created dataset database record

        Raises:
            HTTPException: If validation or processing fails
        """
        # Validate file extension
        if not is_allowed_extension(file.filename):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed types: {', '.join(settings.ALLOWED_EXTENSIONS)}"
            )

        # Generate dataset ID and storage path
        dataset_id = generate_dataset_id()
        storage_dir = get_dataset_storage_path(dataset_id)

        # Sanitize and save file
        safe_filename = sanitize_filename(file.filename)
        file_path = storage_dir / safe_filename

        try:
            # Save uploaded file
            await save_upload_file(file, file_path)

            # Validate file size
            is_valid_size, size_error = check_file_size(file_path, settings.MAX_UPLOAD_SIZE // (1024 * 1024))
            if not is_valid_size:
                delete_dataset_files(dataset_id)
                raise HTTPException(status_code=400, detail=size_error)

            # Validate CSV format
            is_valid_csv, csv_error = validate_csv_file(file_path)
            if not is_valid_csv:
                delete_dataset_files(dataset_id)
                raise HTTPException(status_code=400, detail=csv_error)

            # Load and analyze dataset
            df = pd.read_csv(file_path)

            # Get data summary
            summary = get_data_summary(df)

            # Create database record
            dataset = Dataset(
                dataset_id=dataset_id,
                name=name,
                description=description,
                file_path=str(file_path),
                rows=summary["rows"],
                columns=summary["columns"],
                column_names=summary["column_names"],
                column_types=summary["column_types"],
                missing_values=summary["missing_values"],
                status="uploaded"
            )

            db.add(dataset)
            db.commit()
            db.refresh(dataset)

            return dataset

        except HTTPException:
            # Re-raise HTTP exceptions
            raise
        except Exception as e:
            # Clean up on error
            delete_dataset_files(dataset_id)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to process dataset: {str(e)}"
            )

    @staticmethod
    def load_dataset(dataset_id: str, db: Session) -> Tuple[pd.DataFrame, Dataset]:
        """
        Load a dataset from storage.

        Args:
            dataset_id: Dataset UUID
            db: Database session

        Returns:
            Tuple of (DataFrame, Dataset record)

        Raises:
            HTTPException: If dataset not found or load fails
        """
        # Get dataset record
        dataset = db.query(Dataset).filter(Dataset.dataset_id == dataset_id).first()
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")

        # Load CSV file
        try:
            df = pd.read_csv(dataset.file_path)
            return df, dataset
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to load dataset: {str(e)}"
            )

    @staticmethod
    def get_dataset_preview(
        dataset_id: str,
        db: Session,
        n_rows: int = 10
    ) -> Dict:
        """
        Get a preview of the dataset.

        Args:
            dataset_id: Dataset UUID
            db: Database session
            n_rows: Number of rows to preview

        Returns:
            Dict containing preview data

        Raises:
            HTTPException: If dataset not found
        """
        df, dataset = DataProcessor.load_dataset(dataset_id, db)

        preview = {
            "dataset_id": dataset_id,
            "name": dataset.name,
            "rows": len(df),
            "columns": len(df.columns),
            "preview_data": df.head(n_rows).to_dict(orient='records'),
            "column_info": {
                col: {
                    "type": dataset.column_types.get(col, "unknown"),
                    "missing": dataset.missing_values.get(col, 0),
                    "sample_values": df[col].dropna().head(5).tolist()
                }
                for col in df.columns
            }
        }

        return preview

    @staticmethod
    def delete_dataset(dataset_id: str, db: Session) -> bool:
        """
        Delete a dataset and its associated files.

        Args:
            dataset_id: Dataset UUID
            db: Database session

        Returns:
            bool: True if successful

        Raises:
            HTTPException: If dataset not found
        """
        # Get dataset record
        dataset = db.query(Dataset).filter(Dataset.dataset_id == dataset_id).first()
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")

        try:
            # Delete files
            delete_dataset_files(dataset_id)

            # Delete database record (cascade will delete related records)
            db.delete(dataset)
            db.commit()

            return True

        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Failed to delete dataset: {str(e)}"
            )

    @staticmethod
    def list_datasets(db: Session, skip: int = 0, limit: int = 100) -> list:
        """
        List all datasets with pagination.

        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of Dataset records
        """
        datasets = db.query(Dataset)\
            .order_by(Dataset.uploaded_at.desc())\
            .offset(skip)\
            .limit(limit)\
            .all()

        return datasets

    @staticmethod
    def get_dataset_by_id(dataset_id: str, db: Session) -> Dataset:
        """
        Get a dataset by ID.

        Args:
            dataset_id: Dataset UUID
            db: Database session

        Returns:
            Dataset record

        Raises:
            HTTPException: If dataset not found
        """
        dataset = db.query(Dataset).filter(Dataset.dataset_id == dataset_id).first()
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")

        return dataset

    @staticmethod
    def get_column_statistics(dataset_id: str, column_name: str, db: Session) -> Dict:
        """
        Get detailed statistics for a specific column.

        Args:
            dataset_id: Dataset UUID
            column_name: Name of the column
            db: Database session

        Returns:
            Dict containing column statistics

        Raises:
            HTTPException: If dataset or column not found
        """
        df, dataset = DataProcessor.load_dataset(dataset_id, db)

        if column_name not in df.columns:
            raise HTTPException(status_code=404, detail=f"Column '{column_name}' not found")

        column = df[column_name]
        column_type = dataset.column_types.get(column_name, "unknown")

        stats = {
            "column_name": column_name,
            "type": column_type,
            "total_count": len(column),
            "missing_count": column.isnull().sum(),
            "missing_percentage": (column.isnull().sum() / len(column)) * 100,
        }

        if column_type == "numeric":
            stats.update({
                "mean": float(column.mean()) if not column.isnull().all() else None,
                "std": float(column.std()) if not column.isnull().all() else None,
                "min": float(column.min()) if not column.isnull().all() else None,
                "max": float(column.max()) if not column.isnull().all() else None,
                "median": float(column.median()) if not column.isnull().all() else None,
                "q25": float(column.quantile(0.25)) if not column.isnull().all() else None,
                "q75": float(column.quantile(0.75)) if not column.isnull().all() else None,
            })
        elif column_type in ["categorical", "text"]:
            value_counts = column.value_counts()
            stats.update({
                "unique_count": column.nunique(),
                "most_common": value_counts.head(10).to_dict(),
            })

        return stats
