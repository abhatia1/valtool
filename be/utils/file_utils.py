"""
File Handling Utilities

Functions for file operations, storage, and cleanup.
"""

import os
import shutil
from pathlib import Path
from typing import Optional, Tuple
import uuid
from fastapi import UploadFile
import aiofiles

from core.config import settings


def generate_dataset_id() -> str:
    """
    Generate a unique dataset ID.

    Returns:
        str: UUID string
    """
    return str(uuid.uuid4())


def get_dataset_storage_path(dataset_id: str) -> Path:
    """
    Get the storage directory path for a dataset.

    Args:
        dataset_id: Dataset UUID

    Returns:
        Path: Directory path for dataset storage
    """
    dataset_dir = Path(settings.DATASETS_PATH) / dataset_id
    dataset_dir.mkdir(parents=True, exist_ok=True)
    return dataset_dir


def get_model_storage_path(job_id: str) -> Path:
    """
    Get the storage directory path for a trained model.

    Args:
        job_id: Training job UUID

    Returns:
        Path: Directory path for model storage
    """
    model_dir = Path(settings.MODELS_PATH) / job_id
    model_dir.mkdir(parents=True, exist_ok=True)
    return model_dir


def get_artifacts_storage_path(job_id: str) -> Path:
    """
    Get the storage directory path for training artifacts.

    Args:
        job_id: Training job UUID

    Returns:
        Path: Directory path for artifacts storage
    """
    artifacts_dir = Path(settings.ARTIFACTS_PATH) / job_id
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    return artifacts_dir


async def save_upload_file(upload_file: UploadFile, destination: Path) -> int:
    """
    Save an uploaded file to disk asynchronously.

    Args:
        upload_file: FastAPI UploadFile object
        destination: Destination file path

    Returns:
        int: Number of bytes written

    Raises:
        Exception: If file save fails
    """
    try:
        # Ensure parent directory exists
        destination.parent.mkdir(parents=True, exist_ok=True)

        # Save file asynchronously
        async with aiofiles.open(destination, 'wb') as f:
            content = await upload_file.read()
            await f.write(content)
            return len(content)

    except Exception as e:
        # Clean up partial file if save failed
        if destination.exists():
            destination.unlink()
        raise Exception(f"Failed to save file: {str(e)}")


def delete_dataset_files(dataset_id: str) -> bool:
    """
    Delete all files associated with a dataset.

    Args:
        dataset_id: Dataset UUID

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        dataset_dir = Path(settings.DATASETS_PATH) / dataset_id
        if dataset_dir.exists():
            shutil.rmtree(dataset_dir)
        return True
    except Exception as e:
        print(f"Error deleting dataset files: {str(e)}")
        return False


def delete_model_files(job_id: str) -> bool:
    """
    Delete all files associated with a training job.

    Args:
        job_id: Training job UUID

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Delete model files
        model_dir = Path(settings.MODELS_PATH) / job_id
        if model_dir.exists():
            shutil.rmtree(model_dir)

        # Delete artifact files
        artifacts_dir = Path(settings.ARTIFACTS_PATH) / job_id
        if artifacts_dir.exists():
            shutil.rmtree(artifacts_dir)

        return True
    except Exception as e:
        print(f"Error deleting model files: {str(e)}")
        return False


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename to remove potentially dangerous characters.

    Args:
        filename: Original filename

    Returns:
        str: Sanitized filename
    """
    # Remove path separators and other dangerous characters
    dangerous_chars = ['/', '\\', '..', '\0', '\n', '\r']
    sanitized = filename

    for char in dangerous_chars:
        sanitized = sanitized.replace(char, '_')

    # Limit length
    max_length = 255
    if len(sanitized) > max_length:
        # Keep extension
        name, ext = os.path.splitext(sanitized)
        sanitized = name[:max_length - len(ext)] + ext

    return sanitized


def get_file_extension(filename: str) -> str:
    """
    Get file extension from filename.

    Args:
        filename: Filename with extension

    Returns:
        str: File extension (lowercase, with dot)
    """
    return Path(filename).suffix.lower()


def is_allowed_extension(filename: str, allowed_extensions: Optional[list] = None) -> bool:
    """
    Check if file extension is allowed.

    Args:
        filename: Filename to check
        allowed_extensions: List of allowed extensions (default from settings)

    Returns:
        bool: True if extension is allowed
    """
    if allowed_extensions is None:
        allowed_extensions = settings.ALLOWED_EXTENSIONS

    ext = get_file_extension(filename)
    return ext in allowed_extensions


def get_file_size_mb(file_path: Path) -> float:
    """
    Get file size in megabytes.

    Args:
        file_path: Path to file

    Returns:
        float: File size in MB
    """
    if not file_path.exists():
        return 0.0

    size_bytes = file_path.stat().st_size
    return size_bytes / (1024 * 1024)


def ensure_storage_directories():
    """
    Ensure all required storage directories exist.
    """
    directories = [
        settings.DATASETS_PATH,
        settings.MODELS_PATH,
        settings.ARTIFACTS_PATH,
        settings.MLRUNS_PATH,
    ]

    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)


def cleanup_old_files(days: int = 30):
    """
    Clean up files older than specified days.
    This should be run as a scheduled task.

    Args:
        days: Number of days - files older than this will be deleted
    """
    import time
    current_time = time.time()
    age_threshold = days * 24 * 60 * 60  # Convert days to seconds

    directories = [
        settings.DATASETS_PATH,
        settings.MODELS_PATH,
        settings.ARTIFACTS_PATH,
    ]

    for directory in directories:
        dir_path = Path(directory)
        if not dir_path.exists():
            continue

        for item in dir_path.iterdir():
            if item.is_dir():
                # Check directory modification time
                if (current_time - item.stat().st_mtime) > age_threshold:
                    try:
                        shutil.rmtree(item)
                        print(f"Deleted old directory: {item}")
                    except Exception as e:
                        print(f"Failed to delete {item}: {str(e)}")


def get_storage_usage() -> dict:
    """
    Get storage usage statistics.

    Returns:
        dict: Storage usage information in MB
    """
    def get_directory_size(path: Path) -> float:
        """Calculate total size of a directory in MB"""
        if not path.exists():
            return 0.0

        total_size = 0
        for item in path.rglob('*'):
            if item.is_file():
                total_size += item.stat().st_size
        return total_size / (1024 * 1024)

    return {
        "datasets_mb": get_directory_size(Path(settings.DATASETS_PATH)),
        "models_mb": get_directory_size(Path(settings.MODELS_PATH)),
        "artifacts_mb": get_directory_size(Path(settings.ARTIFACTS_PATH)),
        "mlruns_mb": get_directory_size(Path(settings.MLRUNS_PATH)),
    }
