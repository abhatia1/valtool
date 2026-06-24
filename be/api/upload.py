"""
Upload API Endpoints

Handles dataset upload, listing, and deletion operations.
"""

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from core.database import get_db
from models.schemas import (
    DatasetUploadResponse,
    DatasetListResponse,
    DatasetListItem,
    DatasetDeleteResponse,
)
from services.data_processor import DataProcessor


router = APIRouter()


@router.post("/dataset", response_model=DatasetUploadResponse)
async def upload_dataset(
    file: UploadFile = File(..., description="CSV file to upload"),
    name: str = Form(..., description="Dataset name"),
    description: Optional[str] = Form(None, description="Optional dataset description"),
    db: Session = Depends(get_db)
):
    """
    Upload a new dataset.

    Accepts a CSV file and processes it for use in the ML pipeline.

    Returns:
        DatasetUploadResponse: Dataset metadata including detected column types
    """
    dataset = await DataProcessor.process_upload(
        file=file,
        name=name,
        description=description,
        db=db
    )

    return DatasetUploadResponse(
        dataset_id=dataset.dataset_id,
        name=dataset.name,
        file_path=dataset.file_path,
        rows=dataset.rows,
        columns=dataset.columns,
        column_names=dataset.column_names,
        column_types=dataset.column_types,
        missing_values=dataset.missing_values,
        uploaded_at=dataset.uploaded_at,
        status=dataset.status
    )


@router.get("/datasets", response_model=DatasetListResponse)
def list_datasets(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    List all uploaded datasets.

    Args:
        skip: Number of records to skip (for pagination)
        limit: Maximum number of records to return

    Returns:
        DatasetListResponse: List of datasets
    """
    datasets = DataProcessor.list_datasets(db=db, skip=skip, limit=limit)

    dataset_items = [
        DatasetListItem(
            dataset_id=dataset.dataset_id,
            name=dataset.name,
            rows=dataset.rows,
            columns=dataset.columns,
            uploaded_at=dataset.uploaded_at,
            status=dataset.status
        )
        for dataset in datasets
    ]

    return DatasetListResponse(datasets=dataset_items)


@router.get("/dataset/{dataset_id}")
def get_dataset(dataset_id: str, db: Session = Depends(get_db)):
    """
    Get detailed information about a specific dataset.

    Args:
        dataset_id: Dataset UUID

    Returns:
        Dataset details including metadata
    """
    dataset = DataProcessor.get_dataset_by_id(dataset_id, db)

    return {
        "dataset_id": dataset.dataset_id,
        "name": dataset.name,
        "description": dataset.description,
        "file_path": dataset.file_path,
        "rows": dataset.rows,
        "columns": dataset.columns,
        "column_names": dataset.column_names,
        "column_types": dataset.column_types,
        "missing_values": dataset.missing_values,
        "uploaded_at": dataset.uploaded_at,
        "status": dataset.status,
    }


@router.get("/dataset/{dataset_id}/preview")
def preview_dataset(
    dataset_id: str,
    n_rows: int = 10,
    db: Session = Depends(get_db)
):
    """
    Get a preview of dataset rows and column information.

    Args:
        dataset_id: Dataset UUID
        n_rows: Number of rows to preview (default: 10)

    Returns:
        Dataset preview with sample data
    """
    preview = DataProcessor.get_dataset_preview(dataset_id, db, n_rows)
    return preview


@router.get("/dataset/{dataset_id}/column/{column_name}/stats")
def get_column_stats(
    dataset_id: str,
    column_name: str,
    db: Session = Depends(get_db)
):
    """
    Get detailed statistics for a specific column.

    Args:
        dataset_id: Dataset UUID
        column_name: Name of the column

    Returns:
        Column statistics (varies by column type)
    """
    stats = DataProcessor.get_column_statistics(dataset_id, column_name, db)
    return stats


@router.delete("/dataset/{dataset_id}", response_model=DatasetDeleteResponse)
def delete_dataset(dataset_id: str, db: Session = Depends(get_db)):
    """
    Delete a dataset and all its associated files.

    Args:
        dataset_id: Dataset UUID

    Returns:
        DatasetDeleteResponse: Confirmation message
    """
    DataProcessor.delete_dataset(dataset_id, db)

    return DatasetDeleteResponse(
        message="Dataset deleted successfully",
        deleted_dataset_id=dataset_id
    )
