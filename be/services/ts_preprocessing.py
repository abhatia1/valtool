"""
Time Series Preprocessing Service

Provides specialized preprocessing methods for time series data including
lag features, rolling features, stationarity testing, seasonal decomposition, and differencing.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Tuple, Optional
from statsmodels.tsa.stattools import adfuller, kpss
from statsmodels.tsa.seasonal import seasonal_decompose
import warnings

warnings.filterwarnings('ignore')


class TimeSeriesPreprocessor:
    """
    Time series preprocessing utilities for feature engineering and analysis.

    Provides methods for:
    - Creating lag features
    - Creating rolling window statistics
    - Testing stationarity
    - Seasonal decomposition
    - Differencing for stationarity
    """

    def __init__(self, df: pd.DataFrame, target_column: str, date_column: Optional[str] = None):
        """
        Initialize time series preprocessor.

        Args:
            df: DataFrame with time series data
            target_column: Name of the target column to forecast
            date_column: Optional date column name (if None, uses index)
        """
        self.df = df.copy()
        self.target_column = target_column
        self.date_column = date_column

        # Ensure datetime index
        if date_column and date_column in df.columns:
            self.df[date_column] = pd.to_datetime(self.df[date_column])
            self.df = self.df.sort_values(date_column)
            self.df.set_index(date_column, inplace=True)
        elif not isinstance(self.df.index, pd.DatetimeIndex):
            # If no date column and index is not datetime, create a range index
            self.df.index = pd.date_range(start='2020-01-01', periods=len(self.df), freq='D')

    def create_lag_features(self, lags: List[int]) -> pd.DataFrame:
        """
        Create lagged variables for time series features.

        Args:
            lags: List of lag periods (e.g., [1, 2, 3, 7, 14])

        Returns:
            DataFrame with original data and lag features
        """
        df_lagged = self.df.copy()

        for lag in lags:
            df_lagged[f'{self.target_column}_lag_{lag}'] = df_lagged[self.target_column].shift(lag)

        # Drop rows with NaN values from lagging
        df_lagged = df_lagged.dropna()

        return df_lagged

    def create_rolling_features(self, windows: List[int]) -> pd.DataFrame:
        """
        Create rolling window statistics (mean, std, min, max).

        Args:
            windows: List of window sizes (e.g., [3, 7, 14, 30])

        Returns:
            DataFrame with rolling statistics features
        """
        df_rolling = self.df.copy()

        for window in windows:
            # Rolling mean
            df_rolling[f'{self.target_column}_rolling_mean_{window}'] = (
                df_rolling[self.target_column].rolling(window=window).mean()
            )

            # Rolling std
            df_rolling[f'{self.target_column}_rolling_std_{window}'] = (
                df_rolling[self.target_column].rolling(window=window).std()
            )

            # Rolling min
            df_rolling[f'{self.target_column}_rolling_min_{window}'] = (
                df_rolling[self.target_column].rolling(window=window).min()
            )

            # Rolling max
            df_rolling[f'{self.target_column}_rolling_max_{window}'] = (
                df_rolling[self.target_column].rolling(window=window).max()
            )

        # Drop rows with NaN values from rolling
        df_rolling = df_rolling.dropna()

        return df_rolling

    def check_stationarity(self, series: Optional[pd.Series] = None) -> Dict[str, Any]:
        """
        Test stationarity using Augmented Dickey-Fuller (ADF) and KPSS tests.

        Args:
            series: Optional series to test (defaults to target column)

        Returns:
            Dictionary with test results and interpretation
        """
        if series is None:
            series = self.df[self.target_column]

        # Remove NaN values
        series = series.dropna()

        # ADF test (null hypothesis: series is non-stationary)
        adf_result = adfuller(series, autolag='AIC')

        # KPSS test (null hypothesis: series is stationary)
        kpss_result = kpss(series, regression='c', nlags='auto')

        # Interpret results
        adf_stationary = adf_result[1] < 0.05  # p-value < 0.05 means stationary
        kpss_stationary = kpss_result[1] > 0.05  # p-value > 0.05 means stationary

        # Combined interpretation
        if adf_stationary and kpss_stationary:
            interpretation = "stationary"
            recommendation = "Series is stationary. No differencing needed."
        elif not adf_stationary and not kpss_stationary:
            interpretation = "non_stationary"
            recommendation = "Series is non-stationary. Apply differencing."
        else:
            interpretation = "unclear"
            recommendation = "Tests disagree. Consider trend-differencing or seasonal differencing."

        return {
            "adf_test": {
                "statistic": float(adf_result[0]),
                "p_value": float(adf_result[1]),
                "used_lag": int(adf_result[2]),
                "n_obs": int(adf_result[3]),
                "critical_values": {k: float(v) for k, v in adf_result[4].items()},
                "is_stationary": adf_stationary
            },
            "kpss_test": {
                "statistic": float(kpss_result[0]),
                "p_value": float(kpss_result[1]),
                "used_lag": int(kpss_result[2]),
                "critical_values": {k: float(v) for k, v in kpss_result[3].items()},
                "is_stationary": kpss_stationary
            },
            "interpretation": interpretation,
            "recommendation": recommendation
        }

    def seasonal_decomposition(
        self,
        series: Optional[pd.Series] = None,
        model: str = 'additive',
        period: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Decompose time series into trend, seasonal, and residual components.

        Args:
            series: Optional series to decompose (defaults to target column)
            model: 'additive' or 'multiplicative'
            period: Seasonal period (if None, will be inferred)

        Returns:
            Dictionary with decomposition components
        """
        if series is None:
            series = self.df[self.target_column]

        # Remove NaN values
        series = series.dropna()

        # Infer period if not provided
        if period is None:
            # Try to infer from index frequency
            if hasattr(series.index, 'freq') and series.index.freq:
                freq = series.index.freq
                if freq == 'D':
                    period = 7  # Weekly seasonality for daily data
                elif freq == 'M':
                    period = 12  # Yearly seasonality for monthly data
                elif freq == 'H':
                    period = 24  # Daily seasonality for hourly data
                else:
                    period = 12  # Default
            else:
                period = min(12, len(series) // 2)  # Default to 12 or half the series length

        try:
            # Perform decomposition
            decomposition = seasonal_decompose(series, model=model, period=period, extrapolate_trend='freq')

            return {
                "trend": decomposition.trend.tolist(),
                "seasonal": decomposition.seasonal.tolist(),
                "residual": decomposition.resid.tolist(),
                "observed": series.tolist(),
                "dates": series.index.astype(str).tolist(),
                "model": model,
                "period": period
            }
        except Exception as e:
            return {
                "error": f"Decomposition failed: {str(e)}",
                "trend": [],
                "seasonal": [],
                "residual": [],
                "observed": series.tolist(),
                "dates": series.index.astype(str).tolist(),
                "model": model,
                "period": period
            }

    def difference_series(self, order: int = 1, seasonal_order: int = 0, seasonal_period: int = 12) -> pd.Series:
        """
        Apply differencing to make series stationary.

        Args:
            order: Order of regular differencing (typically 1 or 2)
            seasonal_order: Order of seasonal differencing (0 or 1)
            seasonal_period: Period for seasonal differencing

        Returns:
            Differenced series
        """
        series = self.df[self.target_column].copy()

        # Apply regular differencing
        for _ in range(order):
            series = series.diff()

        # Apply seasonal differencing
        for _ in range(seasonal_order):
            series = series.diff(seasonal_period)

        # Remove NaN values
        series = series.dropna()

        return series

    def create_time_features(self) -> pd.DataFrame:
        """
        Create time-based features from datetime index.

        Returns:
            DataFrame with time features (year, month, day, dayofweek, quarter, etc.)
        """
        df_time = self.df.copy()

        if isinstance(df_time.index, pd.DatetimeIndex):
            df_time['year'] = df_time.index.year
            df_time['month'] = df_time.index.month
            df_time['day'] = df_time.index.day
            df_time['dayofweek'] = df_time.index.dayofweek
            df_time['quarter'] = df_time.index.quarter
            df_time['dayofyear'] = df_time.index.dayofyear
            df_time['weekofyear'] = df_time.index.isocalendar().week
            df_time['is_month_start'] = df_time.index.is_month_start.astype(int)
            df_time['is_month_end'] = df_time.index.is_month_end.astype(int)
            df_time['is_quarter_start'] = df_time.index.is_quarter_start.astype(int)
            df_time['is_quarter_end'] = df_time.index.is_quarter_end.astype(int)

        return df_time

    def get_frequency(self) -> str:
        """
        Infer the frequency of the time series.

        Returns:
            Frequency string (e.g., 'D' for daily, 'M' for monthly)
        """
        if isinstance(self.df.index, pd.DatetimeIndex):
            if hasattr(self.df.index, 'freq') and self.df.index.freq:
                return str(self.df.index.freq)
            else:
                # Infer frequency
                inferred_freq = pd.infer_freq(self.df.index)
                return inferred_freq if inferred_freq else 'unknown'
        return 'unknown'
