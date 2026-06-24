"""
Data Validation Utilities

Functions for validating uploaded datasets and data quality checks.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Any
from pathlib import Path


def detect_column_type(series: pd.Series) -> str:
    """
    Detect the type of a pandas Series column.

    Args:
        series: Pandas Series to analyze

    Returns:
        str: Column type - "numeric", "categorical", "datetime", or "text"
    """
    # Check if datetime
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"

    # Check if numeric
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"

    # For object/string types, determine if categorical or text
    if pd.api.types.is_object_dtype(series):
        unique_ratio = series.nunique() / len(series)

        # If less than 50% unique values, likely categorical
        if unique_ratio < 0.5:
            return "categorical"
        else:
            # Check average string length to distinguish text from categorical
            try:
                avg_length = series.astype(str).str.len().mean()
                if avg_length > 50:  # Long strings likely text
                    return "text"
                else:
                    return "categorical"
            except:
                return "categorical"

    # Default to categorical
    return "categorical"


def analyze_column_types(df: pd.DataFrame) -> Dict[str, str]:
    """
    Analyze and detect types for all columns in a DataFrame.

    Args:
        df: Pandas DataFrame to analyze

    Returns:
        Dict mapping column names to their detected types
    """
    column_types = {}
    for col in df.columns:
        column_types[col] = detect_column_type(df[col])
    return column_types


def count_missing_values(df: pd.DataFrame) -> Dict[str, int]:
    """
    Count missing values for each column.

    Args:
        df: Pandas DataFrame to analyze

    Returns:
        Dict mapping column names to missing value counts
    """
    return df.isnull().sum().to_dict()


def validate_csv_file(file_path: Path) -> Tuple[bool, str]:
    """
    Validate that a file is a valid CSV.

    Args:
        file_path: Path to the CSV file

    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        # Check if file exists
        if not file_path.exists():
            return False, "File does not exist"

        # Check file extension
        if file_path.suffix.lower() not in ['.csv']:
            return False, "Invalid file extension. Only .csv files are allowed"

        # Try to read the CSV
        df = pd.read_csv(file_path, nrows=5)  # Read first 5 rows to validate

        # Check if DataFrame is empty
        if df.empty:
            return False, "CSV file is empty"

        # Check if there are any columns
        if len(df.columns) == 0:
            return False, "CSV file has no columns"

        return True, ""

    except pd.errors.EmptyDataError:
        return False, "CSV file is empty or malformed"
    except pd.errors.ParserError as e:
        return False, f"CSV parsing error: {str(e)}"
    except Exception as e:
        return False, f"Validation error: {str(e)}"


def validate_target_column(df: pd.DataFrame, target_column: str, task_type: str) -> Tuple[bool, List[str]]:
    """
    Validate target column for a specific task type.

    Args:
        df: Pandas DataFrame containing the data
        target_column: Name of the target column
        task_type: Type of ML task (classification, regression, timeseries)

    Returns:
        Tuple of (is_valid, warnings)
    """
    warnings = []

    # Check if column exists
    if target_column not in df.columns:
        return False, [f"Target column '{target_column}' not found in dataset"]

    target = df[target_column]

    # Check for missing values in target
    if target.isnull().sum() > 0:
        warnings.append(f"Target column has {target.isnull().sum()} missing values")

    if task_type == "classification":
        # For classification, target should be categorical
        unique_values = target.nunique()

        if unique_values < 2:
            return False, ["Classification requires at least 2 classes"]

        if unique_values > 100:
            warnings.append(
                f"Target has {unique_values} unique values. "
                "This is unusually high for classification. Consider regression instead."
            )

        # Check for class imbalance
        value_counts = target.value_counts()
        min_class_count = value_counts.min()
        max_class_count = value_counts.max()

        if max_class_count / min_class_count > 10:
            warnings.append(
                "Significant class imbalance detected. "
                "Consider using stratified sampling or SMOTE."
            )

    elif task_type == "regression":
        # For regression, target should be numeric
        if not pd.api.types.is_numeric_dtype(target):
            return False, ["Regression requires numeric target column"]

        # Check for outliers
        q1 = target.quantile(0.25)
        q3 = target.quantile(0.75)
        iqr = q3 - q1
        outlier_count = ((target < (q1 - 1.5 * iqr)) | (target > (q3 + 1.5 * iqr))).sum()

        if outlier_count > len(target) * 0.05:
            warnings.append(
                f"Target has {outlier_count} outliers ({outlier_count/len(target)*100:.1f}%). "
                "Consider outlier handling in preprocessing."
            )

    elif task_type == "timeseries":
        # For time series, target should be numeric
        if not pd.api.types.is_numeric_dtype(target):
            return False, ["Time series forecasting requires numeric target column"]

    return True, warnings


def validate_feature_columns(df: pd.DataFrame, target_column: str) -> List[str]:
    """
    Validate feature columns and generate warnings.

    Args:
        df: Pandas DataFrame containing the data
        target_column: Name of the target column (to exclude from features)

    Returns:
        List of warning messages
    """
    warnings = []
    feature_cols = [col for col in df.columns if col != target_column]

    for col in feature_cols:
        # Check for high cardinality categorical variables
        if df[col].dtype == 'object':
            unique_count = df[col].nunique()
            if unique_count > 50:
                warnings.append(
                    f"Column '{col}' has {unique_count} unique values. "
                    "High cardinality categorical features may cause memory issues."
                )

        # Check for constant columns
        if df[col].nunique() == 1:
            warnings.append(f"Column '{col}' has only one unique value and should be removed")

        # Check for high missing value percentage
        missing_pct = (df[col].isnull().sum() / len(df)) * 100
        if missing_pct > 50:
            warnings.append(
                f"Column '{col}' has {missing_pct:.1f}% missing values. "
                "Consider dropping or using advanced imputation."
            )

    return warnings


def get_data_summary(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Generate summary statistics for a DataFrame.

    Args:
        df: Pandas DataFrame to summarize

    Returns:
        Dict containing summary information
    """
    summary = {
        "rows": len(df),
        "columns": len(df.columns),
        "column_names": df.columns.tolist(),
        "column_types": analyze_column_types(df),
        "missing_values": count_missing_values(df),
        "memory_usage_mb": df.memory_usage(deep=True).sum() / (1024 * 1024),
        "duplicate_rows": df.duplicated().sum(),
    }

    return summary


def check_file_size(file_path: Path, max_size_mb: int = 100) -> Tuple[bool, str]:
    """
    Check if file size is within limits.

    Args:
        file_path: Path to the file
        max_size_mb: Maximum allowed size in megabytes

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not file_path.exists():
        return False, "File does not exist"

    file_size_mb = file_path.stat().st_size / (1024 * 1024)

    if file_size_mb > max_size_mb:
        return False, f"File size ({file_size_mb:.2f}MB) exceeds maximum allowed size ({max_size_mb}MB)"

    return True, ""
