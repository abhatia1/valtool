"""
EDA API Endpoints

Endpoints for exploratory data analysis generation and retrieval.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from core.database import get_db
from services.eda_generator import EDAGenerator
from services.ts_preprocessing import TimeSeriesPreprocessor
from models.database import Dataset, EDAReport
from models.schemas import (
    EDAGenerateRequest,
    EDAGenerateResponse,
    EDAVisualizationResponse
)
import pandas as pd
import uuid
import json
from typing import Optional


router = APIRouter()


@router.post("/generate", response_model=EDAGenerateResponse, status_code=status.HTTP_201_CREATED)
async def generate_eda(
    request: EDAGenerateRequest,
    db: Session = Depends(get_db)
):
    """
    Generate EDA report for a dataset

    This endpoint performs comprehensive exploratory data analysis including:
    - Summary statistics for all columns
    - Distribution plots (histograms with KDE for numeric, bar charts for categorical)
    - Correlation matrix for numeric features
    - Bivariate analysis (scatter plots, box plots)
    - Outlier detection visualizations
    - Automated insights
    """

    # Get dataset
    dataset = db.query(Dataset).filter(Dataset.dataset_id == request.dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with ID {request.dataset_id} not found"
        )

    try:
        # Load data
        df = pd.read_csv(dataset.file_path)

        # Generate EDA
        eda_gen = EDAGenerator(df)
        report = eda_gen.generate_full_report(request.analysis_types, request.target_column)

        # Save to database
        eda_id = str(uuid.uuid4())
        eda_report = EDAReport(
            eda_id=eda_id,
            dataset_id=request.dataset_id,
            summary_statistics=report["summary_statistics"],
            visualizations=report["visualizations"],
            insights=report["insights"],
            target_column=report.get("target_column"),
            target_insights=report.get("target_insights"),
            missing_data_patterns=report.get("missing_data_patterns"),
            data_quality_flags=report.get("data_quality_flags"),
            feature_engineering_suggestions=report.get("feature_engineering_suggestions"),
            class_imbalance_analysis=report.get("class_imbalance_analysis"),
            target_leakage_detection=report.get("target_leakage_detection"),
            multivariate_outliers=report.get("multivariate_outliers"),
            feature_importance=report.get("feature_importance"),
            detailed_univariate_analysis=report.get("detailed_univariate_analysis"),
            multivariate_analysis=report.get("multivariate_analysis"),
            dimensionality_reduction=report.get("dimensionality_reduction")
        )

        db.add(eda_report)
        db.commit()
        db.refresh(eda_report)

        # Format response with visualization URLs
        viz_response = {}

        # Univariate plots
        univariate_count = len(report["visualizations"].get("univariate", []))
        viz_response["univariate"] = [
            f"/api/eda/{eda_id}/visualization/univariate/{i}"
            for i in range(univariate_count)
        ]

        # Bivariate plots
        bivariate_count = len(report["visualizations"].get("bivariate", []))
        viz_response["bivariate"] = [
            f"/api/eda/{eda_id}/visualization/bivariate/{i}"
            for i in range(bivariate_count)
        ]

        # Correlation matrix
        if "correlation_matrix" in report["visualizations"] and report["visualizations"]["correlation_matrix"]:
            viz_response["correlation_matrix"] = f"/api/eda/{eda_id}/visualization/correlation"
        else:
            viz_response["correlation_matrix"] = None

        # Outlier detection plots
        outlier_count = len(report["visualizations"].get("outlier_detection", []))
        viz_response["outlier_detection"] = [
            f"/api/eda/{eda_id}/visualization/outlier/{i}"
            for i in range(outlier_count)
        ]

        # Dimensionality reduction visualizations
        dim_red_count = len(report["visualizations"].get("dimensionality_reduction_viz", []))
        viz_response["dimensionality_reduction_viz"] = [
            f"/api/eda/{eda_id}/visualization/dimensionality_reduction/{i}"
            for i in range(dim_red_count)
        ]

        # Create response
        response = EDAGenerateResponse(
            eda_id=eda_report.eda_id,
            dataset_id=eda_report.dataset_id,
            status="completed",
            summary_statistics=eda_report.summary_statistics,
            visualizations=viz_response,
            insights=eda_report.insights,
            generated_at=eda_report.generated_at,
            target_column=eda_report.target_column,
            target_insights=eda_report.target_insights,
            missing_data_patterns=eda_report.missing_data_patterns,
            data_quality_flags=eda_report.data_quality_flags,
            feature_engineering_suggestions=eda_report.feature_engineering_suggestions,
            class_imbalance_analysis=eda_report.class_imbalance_analysis,
            target_leakage_detection=eda_report.target_leakage_detection,
            multivariate_outliers=eda_report.multivariate_outliers,
            feature_importance=eda_report.feature_importance,
            detailed_univariate_analysis=eda_report.detailed_univariate_analysis,
            multivariate_analysis=eda_report.multivariate_analysis,
            dimensionality_reduction=eda_report.dimensionality_reduction
        )

        return response

    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset file not found at {dataset.file_path}"
        )
    except pd.errors.EmptyDataError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dataset file is empty"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating EDA: {str(e)}"
        )


@router.get("/{eda_id}", response_model=EDAGenerateResponse)
async def get_eda_report(
    eda_id: str,
    db: Session = Depends(get_db)
):
    """
    Get an existing EDA report by ID
    """

    eda_report = db.query(EDAReport).filter(EDAReport.eda_id == eda_id).first()
    if not eda_report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"EDA report with ID {eda_id} not found"
        )

    # Format visualization URLs
    viz_response = {}

    univariate_count = len(eda_report.visualizations.get("univariate", []))
    viz_response["univariate"] = [
        f"/api/eda/{eda_id}/visualization/univariate/{i}"
        for i in range(univariate_count)
    ]

    bivariate_count = len(eda_report.visualizations.get("bivariate", []))
    viz_response["bivariate"] = [
        f"/api/eda/{eda_id}/visualization/bivariate/{i}"
        for i in range(bivariate_count)
    ]

    if "correlation_matrix" in eda_report.visualizations and eda_report.visualizations["correlation_matrix"]:
        viz_response["correlation_matrix"] = f"/api/eda/{eda_id}/visualization/correlation"
    else:
        viz_response["correlation_matrix"] = None

    outlier_count = len(eda_report.visualizations.get("outlier_detection", []))
    viz_response["outlier_detection"] = [
        f"/api/eda/{eda_id}/visualization/outlier/{i}"
        for i in range(outlier_count)
    ]

    dim_red_count = len(eda_report.visualizations.get("dimensionality_reduction_viz", []))
    viz_response["dimensionality_reduction_viz"] = [
        f"/api/eda/{eda_id}/visualization/dimensionality_reduction/{i}"
        for i in range(dim_red_count)
    ]

    return EDAGenerateResponse(
        eda_id=eda_report.eda_id,
        dataset_id=eda_report.dataset_id,
        status="completed",
        summary_statistics=eda_report.summary_statistics,
        visualizations=viz_response,
        insights=eda_report.insights,
        generated_at=eda_report.generated_at,
        target_column=eda_report.target_column if hasattr(eda_report, 'target_column') else None,
        target_insights=eda_report.target_insights if hasattr(eda_report, 'target_insights') else None,
        missing_data_patterns=eda_report.missing_data_patterns if hasattr(eda_report, 'missing_data_patterns') else None,
        data_quality_flags=eda_report.data_quality_flags if hasattr(eda_report, 'data_quality_flags') else None,
        feature_engineering_suggestions=eda_report.feature_engineering_suggestions if hasattr(eda_report, 'feature_engineering_suggestions') else None,
        class_imbalance_analysis=eda_report.class_imbalance_analysis if hasattr(eda_report, 'class_imbalance_analysis') else None,
        target_leakage_detection=eda_report.target_leakage_detection if hasattr(eda_report, 'target_leakage_detection') else None,
        multivariate_outliers=eda_report.multivariate_outliers if hasattr(eda_report, 'multivariate_outliers') else None,
        feature_importance=eda_report.feature_importance if hasattr(eda_report, 'feature_importance') else None,
        detailed_univariate_analysis=eda_report.detailed_univariate_analysis if hasattr(eda_report, 'detailed_univariate_analysis') else None,
        multivariate_analysis=eda_report.multivariate_analysis if hasattr(eda_report, 'multivariate_analysis') else None,
        dimensionality_reduction=eda_report.dimensionality_reduction if hasattr(eda_report, 'dimensionality_reduction') else None
    )


@router.get("/{eda_id}/visualization/correlation", response_model=EDAVisualizationResponse)
async def get_correlation_visualization(
    eda_id: str,
    db: Session = Depends(get_db)
):
    """
    Get the correlation matrix visualization
    """

    eda_report = db.query(EDAReport).filter(EDAReport.eda_id == eda_id).first()
    if not eda_report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"EDA report with ID {eda_id} not found"
        )

    visualizations = eda_report.visualizations

    if "correlation_matrix" in visualizations and visualizations["correlation_matrix"]:
        return EDAVisualizationResponse(
            plotly_json=visualizations["correlation_matrix"]["plotly_json"],
            viz_type="correlation_matrix",
            title="Correlation Matrix"
        )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Correlation matrix visualization not available (requires at least 2 numeric columns)"
    )


@router.get("/{eda_id}/visualization/{viz_category}/{index}", response_model=EDAVisualizationResponse)
async def get_visualization_by_index(
    eda_id: str,
    viz_category: str,
    index: int,
    db: Session = Depends(get_db)
):
    """
    Get a specific visualization by category and index

    Categories:
    - univariate: Distribution plots for individual features
    - bivariate: Relationship plots between feature pairs
    - outlier: Outlier detection box plots
    - dimensionality_reduction: PCA, t-SNE, and scree plot visualizations
    """

    eda_report = db.query(EDAReport).filter(EDAReport.eda_id == eda_id).first()
    if not eda_report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"EDA report with ID {eda_id} not found"
        )

    visualizations = eda_report.visualizations

    # Validate category
    valid_categories = ["univariate", "bivariate", "outlier_detection", "dimensionality_reduction_viz"]
    if viz_category == "outlier":
        viz_category = "outlier_detection"
    elif viz_category == "dimensionality_reduction":
        viz_category = "dimensionality_reduction_viz"

    if viz_category not in valid_categories:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid visualization category. Must be one of: univariate, bivariate, outlier, dimensionality_reduction"
        )

    if viz_category not in visualizations:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No {viz_category} visualizations available"
        )

    viz_list = visualizations[viz_category]

    if not isinstance(viz_list, list):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Invalid visualization data format for {viz_category}"
        )

    if index < 0 or index >= len(viz_list):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Visualization index {index} out of range. Available: 0-{len(viz_list)-1}"
        )

    viz = viz_list[index]

    # Build title
    if "column" in viz:
        title = f"{viz_category.title()} - {viz['column']}"
    elif "columns" in viz:
        title = f"{viz_category.title()} - {' vs '.join(viz['columns'])}"
    else:
        title = f"{viz_category.title()} #{index}"

    return EDAVisualizationResponse(
        plotly_json=viz["plotly_json"],
        viz_type=viz["type"],
        title=title
    )


@router.get("/timeseries/decompose/{dataset_id}")
async def get_time_series_decomposition(
    dataset_id: str,
    target_column: str = Query(..., description="Target column name"),
    date_column: Optional[str] = Query(None, description="Date column name (optional)"),
    model: str = Query("additive", description="Decomposition model: 'additive' or 'multiplicative'"),
    period: Optional[int] = Query(None, description="Seasonal period (auto-inferred if not provided)"),
    db: Session = Depends(get_db)
):
    """
    Perform seasonal decomposition on time series data.

    Decomposes the time series into:
    - Trend component
    - Seasonal component
    - Residual component

    Args:
        dataset_id: Dataset ID
        target_column: Name of the target column to decompose
        date_column: Optional date column name
        model: 'additive' or 'multiplicative'
        period: Seasonal period (e.g., 12 for monthly data with yearly seasonality)
    """
    # Get dataset
    dataset = db.query(Dataset).filter(Dataset.dataset_id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with ID {dataset_id} not found"
        )

    try:
        # Load data
        df = pd.read_csv(dataset.file_path)

        # Initialize preprocessor
        preprocessor = TimeSeriesPreprocessor(df, target_column, date_column)

        # Perform decomposition
        decomposition_result = preprocessor.seasonal_decomposition(
            series=None,
            model=model,
            period=period
        )

        return {
            "dataset_id": dataset_id,
            "target_column": target_column,
            "model": model,
            "period": decomposition_result.get("period"),
            "decomposition": {
                "observed": decomposition_result.get("observed", []),
                "trend": decomposition_result.get("trend", []),
                "seasonal": decomposition_result.get("seasonal", []),
                "residual": decomposition_result.get("residual", []),
                "dates": decomposition_result.get("dates", [])
            },
            "error": decomposition_result.get("error")
        }

    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset file not found at {dataset.file_path}"
        )
    except KeyError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Column not found: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error performing decomposition: {str(e)}"
        )


@router.get("/timeseries/stationarity/{dataset_id}")
async def get_stationarity_test(
    dataset_id: str,
    target_column: str = Query(..., description="Target column name"),
    date_column: Optional[str] = Query(None, description="Date column name (optional)"),
    db: Session = Depends(get_db)
):
    """
    Test time series stationarity using ADF and KPSS tests.

    Returns:
    - ADF test results (null hypothesis: series is non-stationary)
    - KPSS test results (null hypothesis: series is stationary)
    - Interpretation and recommendations

    Args:
        dataset_id: Dataset ID
        target_column: Name of the target column to test
        date_column: Optional date column name
    """
    # Get dataset
    dataset = db.query(Dataset).filter(Dataset.dataset_id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with ID {dataset_id} not found"
        )

    try:
        # Load data
        df = pd.read_csv(dataset.file_path)

        # Initialize preprocessor
        preprocessor = TimeSeriesPreprocessor(df, target_column, date_column)

        # Check stationarity
        stationarity_result = preprocessor.check_stationarity()

        # Get frequency info
        frequency = preprocessor.get_frequency()

        return {
            "dataset_id": dataset_id,
            "target_column": target_column,
            "frequency": frequency,
            "stationarity_tests": stationarity_result,
            "summary": {
                "is_stationary": stationarity_result["interpretation"] == "stationary",
                "recommendation": stationarity_result["recommendation"]
            }
        }

    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset file not found at {dataset.file_path}"
        )
    except KeyError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Column not found: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error testing stationarity: {str(e)}"
        )


@router.delete("/{eda_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_eda_report(
    eda_id: str,
    db: Session = Depends(get_db)
):
    """
    Delete an EDA report
    """

    eda_report = db.query(EDAReport).filter(EDAReport.eda_id == eda_id).first()
    if not eda_report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"EDA report with ID {eda_id} not found"
        )

    db.delete(eda_report)
    db.commit()

    return None
