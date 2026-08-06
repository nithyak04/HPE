"""
Geo-Only Revenue Forecast - Version 2 - Monthly ML Snapshot Model
===================================================================

Python translation of ``Upgraded_Rev_Model_FINAL.R``.

The model trains three "snapshots" of XGBoost regressors per target month,
one for each stage of quarter completion:

  * Snapshot 0 (no months of the target quarter loaded yet)
      -> predicts M1, M2, M3
  * Snapshot 1 (M1 loaded)
      -> predicts M2, M3
  * Snapshot 2 (M1 + M2 loaded)
      -> predicts M3

Each model regresses log1p(revenue) on quarter-lag/trend features plus
geo and fiscal-quarter dummies, weighted by recency. At scoring time the
snapshot matching how much of the current quarter has actually loaded is
used, actual months are passed straight through, and an optional
"flash" quarter-level guidance file can nudge the *remaining* forecast
(capped at +/- ``flash_move_cap_pct``) without touching already-actual
months.

This is a line-by-line port intended to reproduce the R script's logic,
not a redesign. See README.md in this directory for notes on where the
Python and R implementations differ in mechanics (but not in intent).

Usage
-----
Edit the ``DEFAULT_CONFIG`` dict below to point at your files/settings,
then run:

    python revenue_forecast_v2.py

Or import and call ``main(config=...)`` with your own config dict (see
README.md for the full list of keys).
"""

from __future__ import annotations

import itertools
from typing import Any, Optional

import numpy as np
import pandas as pd
import xgboost as xgb

# ============================================================
# SETTINGS
# ============================================================

DEFAULT_CONFIG: dict[str, Any] = {
    "file_path": "FY26 Model rdata Rev FY22_FY26.csv",
    "value_col": "FLASH",
    "prod_year": 2026,
    "prod_qtr": 3,
    "target_geos": [
        "India", "NWE", "UKIMEA", "North America",
        "Japan", "LASER South", "APAC",
        "LASER Latin America", "Central",
    ],
    # --------------------------------
    # Optional flash overlay
    # Quarter-level guidance applied
    # only to remaining months
    # --------------------------------
    "use_flash": True,
    "flash_file": "geo_flash_qtr.csv",
    "flash_move_cap_pct": 0.25,
    # --------------------------------
    # Optional exports
    # --------------------------------
    "save_outputs": False,
    "output_prefix": "revenue_ml_v2",
    # --------------------------------
    # XGBoost params
    # --------------------------------
    "xgb_nrounds": 350,
    "xgb_max_depth": 4,
    "xgb_eta": 0.04,
    "xgb_subsample": 0.85,
    "xgb_colsample": 0.85,
    "xgb_min_child_weight": 3,
    # --------------------------------
    # Recency weighting
    # More recent quarters count more
    # --------------------------------
    "recency_decay": 0.80,
    "min_recency_weight": 0.10,
}

# Numeric predictors used by every snapshot model, in a fixed order.
# (SG_L03_desc and Quarter are handled separately as one-hot dummies -
# see build_design_matrix.)
NUMERIC_FEATURE_COLS: list[str] = [
    "Fiscal.Year",
    "QTR_INDEX",
    "PREV_QTR_TOTAL",
    "PREV2_QTR_TOTAL",
    "PREV3_QTR_TOTAL",
    "SAME_QTR_LAST_YEAR",
    "SAME_QTR_2YA",
    "ROLL2_QTR",
    "ROLL4_QTR",
    "QOQ_LAST",
    "YOY_SAME_QTR",
    "PREV_M1_SHARE",
    "PREV_M2_SHARE",
    "PREV_M3_SHARE",
    "ACTUAL_TO_DATE",
    "LOADED_M1",
    "LOADED_M2",
    "LOADED_SHARE_PREV_QTR",
    "LOADED_SHARE_SAME_QTR_LY",
]

# Columns shared by every snapshot's training/scoring frame before the
# snapshot-specific ACTUAL_TO_DATE / LOADED_* / TARGET_* columns are added.
SNAPSHOT_BASE_COLS: list[str] = [
    "SG_L03_desc", "Fiscal.Year", "Quarter", "QTR_INDEX",
    "PREV_QTR_TOTAL", "PREV2_QTR_TOTAL", "PREV3_QTR_TOTAL",
    "SAME_QTR_LAST_YEAR", "SAME_QTR_2YA", "ROLL2_QTR", "ROLL4_QTR",
    "QOQ_LAST", "YOY_SAME_QTR", "PREV_M1_SHARE", "PREV_M2_SHARE", "PREV_M3_SHARE",
]


# ============================================================
# HELPERS
# ============================================================

def safe_num(s: pd.Series) -> pd.Series:
    """R: safe_num <- function(x) as.numeric(gsub(",", "", x))"""
    return pd.to_numeric(s.astype(str).str.replace(",", "", regex=False), errors="coerce")


def quarter_months(q: int) -> list[int]:
    """R: quarter_months <- function(q) ((q - 1) * 3 + 1):(q * 3)"""
    return list(range((q - 1) * 3 + 1, q * 3 + 1))


def make_quarter_index(year, quarter):
    """R: make_quarter_index <- function(year, quarter) year * 4 + quarter"""
    return year * 4 + quarter


def fill_lag_defaults(df: pd.DataFrame) -> pd.DataFrame:
    """Fill NA lag/trend/share features with the same defaults the R
    script uses in hist_full / score_base (a pre-model-matrix safety net
    on top of the coalesce already applied by coalesce_model_fields)."""
    df = df.copy()
    df["PREV_QTR_TOTAL"] = df["PREV_QTR_TOTAL"].fillna(0)
    df["PREV2_QTR_TOTAL"] = df["PREV2_QTR_TOTAL"].fillna(0)
    df["PREV3_QTR_TOTAL"] = df["PREV3_QTR_TOTAL"].fillna(0)
    df["SAME_QTR_LAST_YEAR"] = df["SAME_QTR_LAST_YEAR"].fillna(0)
    df["SAME_QTR_2YA"] = df["SAME_QTR_2YA"].fillna(0)
    df["ROLL2_QTR"] = df["ROLL2_QTR"].fillna(df["PREV_QTR_TOTAL"]).fillna(0)
    df["ROLL4_QTR"] = df["ROLL4_QTR"].fillna(df["ROLL2_QTR"]).fillna(df["PREV_QTR_TOTAL"]).fillna(0)
    df["QOQ_LAST"] = df["QOQ_LAST"].fillna(1)
    df["YOY_SAME_QTR"] = df["YOY_SAME_QTR"].fillna(1)
    df["PREV_M1_SHARE"] = df["PREV_M1_SHARE"].fillna(1 / 3)
    df["PREV_M2_SHARE"] = df["PREV_M2_SHARE"].fillna(1 / 3)
    df["PREV_M3_SHARE"] = df["PREV_M3_SHARE"].fillna(1 / 3)
    return df


def coalesce_model_fields(df: pd.DataFrame) -> pd.DataFrame:
    """R: coalesce_model_fields() - final NA safety net applied right
    before building the design matrix, for both training and scoring."""
    df = df.copy()
    df["Fiscal.Year"] = df["Fiscal.Year"].astype(int)
    df["Quarter"] = df["Quarter"].astype(int)
    df["QTR_INDEX"] = df["QTR_INDEX"].astype(float)

    df = fill_lag_defaults(df)

    df["ACTUAL_TO_DATE"] = df["ACTUAL_TO_DATE"].fillna(0)
    df["LOADED_M1"] = df["LOADED_M1"].fillna(0)
    df["LOADED_M2"] = df["LOADED_M2"].fillna(0)
    df["LOADED_SHARE_PREV_QTR"] = df["LOADED_SHARE_PREV_QTR"].fillna(0)
    df["LOADED_SHARE_SAME_QTR_LY"] = df["LOADED_SHARE_SAME_QTR_LY"].fillna(0)
    return df


def build_design_matrix(
    df: pd.DataFrame,
    geo_levels: list[str],
    blueprint_cols: Optional[list[str]] = None,
) -> pd.DataFrame:
    """R: make_x_matrix() built on top of model.matrix(feature_formula, ...).

    SG_L03_desc and Quarter are one-hot encoded (first level dropped, to
    mirror R's default treatment-contrast coding with the intercept
    column stripped afterwards); every other feature is numeric.

    When ``blueprint_cols`` is given (at scoring time, using the columns
    the model was trained on) missing columns are added as zero and any
    extra/unexpected columns are dropped, matching the R blueprint logic.
    """
    df = coalesce_model_fields(df)

    geo_dummies = pd.get_dummies(
        pd.Categorical(df["SG_L03_desc"], categories=geo_levels),
        prefix="SG_L03_desc",
        drop_first=True,
    )
    qtr_dummies = pd.get_dummies(
        pd.Categorical(df["Quarter"], categories=[1, 2, 3, 4]),
        prefix="QuarterF",
        drop_first=True,
    )
    geo_dummies.index = df.index
    qtr_dummies.index = df.index

    numeric = df[NUMERIC_FEATURE_COLS].astype(float)

    mm = pd.concat([geo_dummies.astype(float), qtr_dummies.astype(float), numeric], axis=1)

    if blueprint_cols is not None:
        mm = mm.reindex(columns=list(blueprint_cols), fill_value=0.0)

    return mm


def fit_xgb_log_model(
    train_df: pd.DataFrame,
    target_col: str,
    geo_levels: list[str],
    xgb_params: dict[str, Any],
    num_boost_round: int,
) -> dict[str, Any]:
    """R: fit_xgb_log_model() - trains on log1p(max(y, 0)) with recency weights."""
    keep = train_df[target_col].notna() & np.isfinite(train_df[target_col])
    train_sub = train_df.loc[keep].reset_index(drop=True)

    if train_sub.empty:
        raise ValueError(f"No rows available to train target: {target_col}")

    y_raw = train_sub[target_col].to_numpy(dtype=float)
    y = np.log1p(np.clip(y_raw, 0, None))

    x = build_design_matrix(train_sub, geo_levels)
    w = (
        train_sub["RECENCY_WT"].to_numpy(dtype=float)
        if "RECENCY_WT" in train_sub.columns
        else np.ones(len(train_sub))
    )

    dtrain = xgb.DMatrix(x.to_numpy(dtype=float), label=y, weight=w, feature_names=list(x.columns))
    booster = xgb.train(xgb_params, dtrain, num_boost_round=num_boost_round)

    return {
        "model": booster,
        "feature_cols": list(x.columns),
        "target_col": target_col,
    }


def predict_xgb_log_model(fit_obj: dict[str, Any], new_df: pd.DataFrame, geo_levels: list[str]) -> np.ndarray:
    """R: predict_xgb_log_model() - back-transforms with expm1."""
    x_new = build_design_matrix(new_df, geo_levels, blueprint_cols=fit_obj["feature_cols"])
    dnew = xgb.DMatrix(x_new.to_numpy(dtype=float), feature_names=fit_obj["feature_cols"])
    pred_log = fit_obj["model"].predict(dnew)
    return np.expm1(pred_log)


# ============================================================
# MAIN PIPELINE
# ============================================================

def main(config: Optional[dict[str, Any]] = None) -> dict[str, pd.DataFrame]:
    cfg = {**DEFAULT_CONFIG, **(config or {})}

    file_path = cfg["file_path"]
    value_col = cfg["value_col"]
    prod_year = cfg["prod_year"]
    prod_qtr = cfg["prod_qtr"]
    target_geos: list[str] = cfg["target_geos"]

    use_flash = cfg["use_flash"]
    flash_file = cfg["flash_file"]
    flash_move_cap_pct = cfg["flash_move_cap_pct"]

    save_outputs = cfg["save_outputs"]
    output_prefix = cfg["output_prefix"]

    xgb_params = {
        "objective": "reg:squarederror",
        "max_depth": cfg["xgb_max_depth"],
        "eta": cfg["xgb_eta"],
        "subsample": cfg["xgb_subsample"],
        "colsample_bytree": cfg["xgb_colsample"],
        "min_child_weight": cfg["xgb_min_child_weight"],
        "verbosity": 0,
    }
    xgb_nrounds = cfg["xgb_nrounds"]

    recency_decay = cfg["recency_decay"]
    min_recency_weight = cfg["min_recency_weight"]

    # ============================================================
    # LOAD + CLEAN
    # ============================================================

    raw = pd.read_csv(file_path, dtype=str)
    df = raw[["SG_L03_desc", "Fiscal.Year", "Fiscal.Month", "Quarter", "Month.in.Quarter", value_col]].copy()
    df = df.rename(columns={value_col: "VALUE"})

    df["SG_L03_desc"] = df["SG_L03_desc"].str.strip()
    df["VALUE"] = safe_num(df["VALUE"])
    df["Fiscal.Year"] = pd.to_numeric(
        df["Fiscal.Year"].str.replace(r"[^0-9]", "", regex=True), errors="coerce"
    )
    df["Fiscal.Month"] = pd.to_numeric(df["Fiscal.Month"], errors="coerce")
    df["Quarter"] = pd.to_numeric(df["Quarter"], errors="coerce")
    df["Month.in.Quarter"] = pd.to_numeric(df["Month.in.Quarter"], errors="coerce")

    df = df[df["SG_L03_desc"].isin(target_geos)]
    df = df.dropna(subset=["VALUE", "Fiscal.Year", "Fiscal.Month", "Quarter", "Month.in.Quarter"])

    for c in ["Fiscal.Year", "Fiscal.Month", "Quarter", "Month.in.Quarter"]:
        df[c] = df[c].astype(int)
    df = df.reset_index(drop=True)

    # ============================================================
    # GEO MONTH + QUARTER
    # ============================================================

    geo_month = (
        df.groupby(["SG_L03_desc", "Fiscal.Year", "Quarter", "Fiscal.Month", "Month.in.Quarter"], as_index=False)
        .agg(GEO_VALUE=("VALUE", "sum"))
    )

    # geo_qtr is computed for parity with the R script; it isn't consumed
    # further downstream there either, but kept here for anyone extending
    # this pipeline for quarter-level diagnostics.
    geo_qtr = (
        geo_month.groupby(["SG_L03_desc", "Fiscal.Year", "Quarter"], as_index=False)
        .agg(GEO_QTR=("GEO_VALUE", "sum"))
    )

    # ============================================================
    # BUILD COMPLETE GEO-YEAR-QUARTER GRID
    # ============================================================

    all_years = sorted(set(geo_month["Fiscal.Year"]).union({prod_year}))

    quarter_grid = pd.DataFrame(
        list(itertools.product(target_geos, all_years, [1, 2, 3, 4])),
        columns=["SG_L03_desc", "Fiscal.Year", "Quarter"],
    )

    month_wide = (
        geo_month[["SG_L03_desc", "Fiscal.Year", "Quarter", "Month.in.Quarter", "GEO_VALUE"]]
        .assign(MIQ=lambda d: "M" + d["Month.in.Quarter"].astype(str))
        .drop(columns="Month.in.Quarter")
        .pivot(index=["SG_L03_desc", "Fiscal.Year", "Quarter"], columns="MIQ", values="GEO_VALUE")
        .reset_index()
    )
    month_wide.columns.name = None
    for m in ("M1", "M2", "M3"):
        if m not in month_wide.columns:
            month_wide[m] = np.nan

    quarter_tbl = quarter_grid.merge(month_wide, on=["SG_L03_desc", "Fiscal.Year", "Quarter"], how="left")
    quarter_tbl["QTR_TOTAL"] = quarter_tbl[["M1", "M2", "M3"]].sum(axis=1, skipna=True)
    quarter_tbl["QTR_INDEX"] = make_quarter_index(quarter_tbl["Fiscal.Year"], quarter_tbl["Quarter"])
    quarter_tbl = quarter_tbl.sort_values(["SG_L03_desc", "Fiscal.Year", "Quarter"]).reset_index(drop=True)

    # ============================================================
    # LAG / TREND / SHAPE FEATURES
    # ============================================================

    with np.errstate(divide="ignore", invalid="ignore"):
        quarter_tbl["CURR_M1_SHARE"] = np.where(
            quarter_tbl["M1"].isna() | (quarter_tbl["QTR_TOTAL"] == 0),
            np.nan,
            quarter_tbl["M1"] / quarter_tbl["QTR_TOTAL"],
        )
        quarter_tbl["CURR_M2_SHARE"] = np.where(
            quarter_tbl["M2"].isna() | (quarter_tbl["QTR_TOTAL"] == 0),
            np.nan,
            quarter_tbl["M2"] / quarter_tbl["QTR_TOTAL"],
        )
        quarter_tbl["CURR_M3_SHARE"] = np.where(
            quarter_tbl["M3"].isna() | (quarter_tbl["QTR_TOTAL"] == 0),
            np.nan,
            quarter_tbl["M3"] / quarter_tbl["QTR_TOTAL"],
        )

    quarter_tbl = quarter_tbl.sort_values(["SG_L03_desc", "Fiscal.Year", "Quarter"]).reset_index(drop=True)
    g = quarter_tbl.groupby("SG_L03_desc")

    lag1 = g["QTR_TOTAL"].shift(1)
    lag2 = g["QTR_TOTAL"].shift(2)
    lag3 = g["QTR_TOTAL"].shift(3)
    lag4 = g["QTR_TOTAL"].shift(4)
    lag5 = g["QTR_TOTAL"].shift(5)
    lag8 = g["QTR_TOTAL"].shift(8)

    quarter_tbl["PREV_QTR_TOTAL"] = lag1
    quarter_tbl["PREV2_QTR_TOTAL"] = lag2
    quarter_tbl["PREV3_QTR_TOTAL"] = lag3
    quarter_tbl["SAME_QTR_LAST_YEAR"] = lag4
    quarter_tbl["SAME_QTR_2YA"] = lag8

    quarter_tbl["ROLL2_QTR"] = (lag1 + lag2) / 2
    quarter_tbl["ROLL4_QTR"] = (lag1 + lag2 + lag3 + lag4) / 4

    with np.errstate(divide="ignore", invalid="ignore"):
        quarter_tbl["QOQ_LAST"] = lag1 / lag2.replace(0, np.nan)
        quarter_tbl["YOY_SAME_QTR"] = lag1 / lag5.replace(0, np.nan)

    quarter_tbl["PREV_M1_SHARE"] = g["CURR_M1_SHARE"].shift(1)
    quarter_tbl["PREV_M2_SHARE"] = g["CURR_M2_SHARE"].shift(1)
    quarter_tbl["PREV_M3_SHARE"] = g["CURR_M3_SHARE"].shift(1)

    # ============================================================
    # RECENCY WEIGHTS
    # ============================================================

    max_qtr_index = quarter_tbl["QTR_INDEX"].max()
    quarter_tbl["QTR_AGE"] = max_qtr_index - quarter_tbl["QTR_INDEX"]
    quarter_tbl["RECENCY_WT"] = np.maximum(recency_decay ** quarter_tbl["QTR_AGE"], min_recency_weight)

    # ============================================================
    # CURRENT TARGET QUARTER STATUS
    # ============================================================

    q_months = quarter_months(prod_qtr)

    current_months = geo_month[(geo_month["Fiscal.Year"] == prod_year) & (geo_month["Quarter"] == prod_qtr)]
    latest_actual_miq = 0 if current_months.empty else int(current_months["Month.in.Quarter"].max())

    print("\n=== TARGET QUARTER STATUS ===")
    print(f"Prod Year: {prod_year}")
    print(f"Prod Quarter: {prod_qtr}")
    print(f"Latest actual Month.in.Quarter loaded: {latest_actual_miq}")
    print(f"Fiscal months in target quarter: {', '.join(str(m) for m in q_months)}")

    # ============================================================
    # TRAINING SET = FULL HISTORICAL QUARTERS ONLY
    # ============================================================

    hist_full = quarter_tbl[
        ~((quarter_tbl["Fiscal.Year"] == prod_year) & (quarter_tbl["Quarter"] == prod_qtr))
        & quarter_tbl["M1"].notna()
        & quarter_tbl["M2"].notna()
        & quarter_tbl["M3"].notna()
    ].copy()
    hist_full = fill_lag_defaults(hist_full)

    # ============================================================
    # SNAPSHOT TRAINING TABLES
    # ============================================================

    # Snapshot 0: predict M1 / M2 / M3 before any month is loaded
    train_s0 = hist_full[SNAPSHOT_BASE_COLS].copy()
    train_s0["ACTUAL_TO_DATE"] = 0.0
    train_s0["LOADED_M1"] = 0.0
    train_s0["LOADED_M2"] = 0.0
    train_s0["LOADED_SHARE_PREV_QTR"] = 0.0
    train_s0["LOADED_SHARE_SAME_QTR_LY"] = 0.0
    train_s0["TARGET_M1"] = hist_full["M1"]
    train_s0["TARGET_M2"] = hist_full["M2"]
    train_s0["TARGET_M3"] = hist_full["M3"]
    train_s0["RECENCY_WT"] = hist_full["RECENCY_WT"]

    # Snapshot 1: M1 loaded, predict M2 / M3
    train_s1 = hist_full[SNAPSHOT_BASE_COLS].copy()
    train_s1["ACTUAL_TO_DATE"] = hist_full["M1"]
    train_s1["LOADED_M1"] = hist_full["M1"]
    train_s1["LOADED_M2"] = 0.0
    with np.errstate(divide="ignore", invalid="ignore"):
        train_s1["LOADED_SHARE_PREV_QTR"] = hist_full["M1"] / hist_full["PREV_QTR_TOTAL"].replace(0, np.nan)
        train_s1["LOADED_SHARE_SAME_QTR_LY"] = hist_full["M1"] / hist_full["SAME_QTR_LAST_YEAR"].replace(0, np.nan)
    train_s1["LOADED_SHARE_PREV_QTR"] = train_s1["LOADED_SHARE_PREV_QTR"].fillna(0)
    train_s1["LOADED_SHARE_SAME_QTR_LY"] = train_s1["LOADED_SHARE_SAME_QTR_LY"].fillna(0)
    train_s1["TARGET_M2"] = hist_full["M2"]
    train_s1["TARGET_M3"] = hist_full["M3"]
    train_s1["RECENCY_WT"] = hist_full["RECENCY_WT"]

    # Snapshot 2: M1 + M2 loaded, predict M3
    train_s2 = hist_full[SNAPSHOT_BASE_COLS].copy()
    m1_plus_m2 = hist_full["M1"] + hist_full["M2"]
    train_s2["ACTUAL_TO_DATE"] = m1_plus_m2
    train_s2["LOADED_M1"] = hist_full["M1"]
    train_s2["LOADED_M2"] = hist_full["M2"]
    with np.errstate(divide="ignore", invalid="ignore"):
        train_s2["LOADED_SHARE_PREV_QTR"] = m1_plus_m2 / hist_full["PREV_QTR_TOTAL"].replace(0, np.nan)
        train_s2["LOADED_SHARE_SAME_QTR_LY"] = m1_plus_m2 / hist_full["SAME_QTR_LAST_YEAR"].replace(0, np.nan)
    train_s2["LOADED_SHARE_PREV_QTR"] = train_s2["LOADED_SHARE_PREV_QTR"].fillna(0)
    train_s2["LOADED_SHARE_SAME_QTR_LY"] = train_s2["LOADED_SHARE_SAME_QTR_LY"].fillna(0)
    train_s2["TARGET_M3"] = hist_full["M3"]
    train_s2["RECENCY_WT"] = hist_full["RECENCY_WT"]

    # ============================================================
    # TRAIN MODELS
    # ============================================================

    print("\n=== TRAINING MONTHLY ML MODELS ===")

    fit_m1_s0 = fit_xgb_log_model(train_s0, "TARGET_M1", target_geos, xgb_params, xgb_nrounds)
    fit_m2_s0 = fit_xgb_log_model(train_s0, "TARGET_M2", target_geos, xgb_params, xgb_nrounds)
    fit_m3_s0 = fit_xgb_log_model(train_s0, "TARGET_M3", target_geos, xgb_params, xgb_nrounds)

    fit_m2_s1 = fit_xgb_log_model(train_s1, "TARGET_M2", target_geos, xgb_params, xgb_nrounds)
    fit_m3_s1 = fit_xgb_log_model(train_s1, "TARGET_M3", target_geos, xgb_params, xgb_nrounds)

    fit_m3_s2 = fit_xgb_log_model(train_s2, "TARGET_M3", target_geos, xgb_params, xgb_nrounds)

    print("Training complete.")
    print(f"Rows in Snapshot 0: {len(train_s0)}")
    print(f"Rows in Snapshot 1: {len(train_s1)}")
    print(f"Rows in Snapshot 2: {len(train_s2)}")

    # ============================================================
    # BUILD CURRENT QUARTER SCORE BASE
    # ============================================================

    score_cols = SNAPSHOT_BASE_COLS + ["M1", "M2", "M3"]
    score_base = quarter_tbl[
        (quarter_tbl["Fiscal.Year"] == prod_year)
        & (quarter_tbl["Quarter"] == prod_qtr)
        & quarter_tbl["SG_L03_desc"].isin(target_geos)
    ][score_cols].copy()
    score_base = fill_lag_defaults(score_base)

    # If month is globally loaded but a geo has no row, treat as 0 loaded
    if latest_actual_miq >= 1:
        score_base["M1"] = score_base["M1"].fillna(0)
    if latest_actual_miq >= 2:
        score_base["M2"] = score_base["M2"].fillna(0)
    if latest_actual_miq >= 3:
        score_base["M3"] = score_base["M3"].fillna(0)

    # ============================================================
    # SCORE CURRENT QUARTER
    # ============================================================

    score_output = score_base.copy()

    if latest_actual_miq == 0:
        score_s0 = score_base[SNAPSHOT_BASE_COLS].copy()
        score_s0["ACTUAL_TO_DATE"] = 0.0
        score_s0["LOADED_M1"] = 0.0
        score_s0["LOADED_M2"] = 0.0
        score_s0["LOADED_SHARE_PREV_QTR"] = 0.0
        score_s0["LOADED_SHARE_SAME_QTR_LY"] = 0.0

        score_output["RAW_PRED_M1"] = predict_xgb_log_model(fit_m1_s0, score_s0, target_geos)
        score_output["RAW_PRED_M2"] = predict_xgb_log_model(fit_m2_s0, score_s0, target_geos)
        score_output["RAW_PRED_M3"] = predict_xgb_log_model(fit_m3_s0, score_s0, target_geos)

    elif latest_actual_miq == 1:
        m1 = score_base["M1"].fillna(0)
        score_s1 = score_base[SNAPSHOT_BASE_COLS].copy()
        score_s1["ACTUAL_TO_DATE"] = m1
        score_s1["LOADED_M1"] = m1
        score_s1["LOADED_M2"] = 0.0
        with np.errstate(divide="ignore", invalid="ignore"):
            score_s1["LOADED_SHARE_PREV_QTR"] = (m1 / score_base["PREV_QTR_TOTAL"].replace(0, np.nan)).fillna(0)
            score_s1["LOADED_SHARE_SAME_QTR_LY"] = (
                m1 / score_base["SAME_QTR_LAST_YEAR"].replace(0, np.nan)
            ).fillna(0)

        score_output["RAW_PRED_M1"] = m1
        score_output["RAW_PRED_M2"] = predict_xgb_log_model(fit_m2_s1, score_s1, target_geos)
        score_output["RAW_PRED_M3"] = predict_xgb_log_model(fit_m3_s1, score_s1, target_geos)

    else:  # latest_actual_miq >= 2
        m1 = score_base["M1"].fillna(0)
        m2 = score_base["M2"].fillna(0)
        score_s2 = score_base[SNAPSHOT_BASE_COLS].copy()
        score_s2["ACTUAL_TO_DATE"] = m1 + m2
        score_s2["LOADED_M1"] = m1
        score_s2["LOADED_M2"] = m2
        with np.errstate(divide="ignore", invalid="ignore"):
            score_s2["LOADED_SHARE_PREV_QTR"] = (
                (m1 + m2) / score_base["PREV_QTR_TOTAL"].replace(0, np.nan)
            ).fillna(0)
            score_s2["LOADED_SHARE_SAME_QTR_LY"] = (
                (m1 + m2) / score_base["SAME_QTR_LAST_YEAR"].replace(0, np.nan)
            ).fillna(0)

        score_output["RAW_PRED_M1"] = m1
        score_output["RAW_PRED_M2"] = m2
        score_output["RAW_PRED_M3"] = predict_xgb_log_model(fit_m3_s2, score_s2, target_geos)

    # ============================================================
    # SOURCE ACTUALS FOR CURRENT TARGET QUARTER
    # (use source table directly, not M1/M2/M3 from score table)
    # ============================================================

    source_actuals = (
        geo_month[(geo_month["Fiscal.Year"] == prod_year) & (geo_month["Quarter"] == prod_qtr)]
        [["SG_L03_desc", "Month.in.Quarter", "Fiscal.Month", "GEO_VALUE"]]
        .rename(columns={"GEO_VALUE": "ACTUAL_VALUE"})
        .sort_values(["SG_L03_desc", "Month.in.Quarter"])
        .reset_index(drop=True)
    )

    print("\n=== SOURCE ACTUALS (CURRENT TARGET QUARTER) ===")
    print(source_actuals)

    print("\n=== SOURCE ACTUALS BY GEO ===")
    source_actual_geo = (
        source_actuals.groupby("SG_L03_desc", as_index=False)
        .agg(ACTUAL_TOTAL=("ACTUAL_VALUE", "sum"))
        .sort_values("ACTUAL_TOTAL", ascending=False)
        .reset_index(drop=True)
    )
    print(source_actual_geo)

    if len(source_actual_geo) > 0 and source_actual_geo["ACTUAL_TOTAL"].nunique() == 1:
        print("\n*** WARNING: Source actual totals are identical across all geos. ***")
        print("*** If that is not expected, the issue is upstream in the source file or selected value_col. ***")

    # ============================================================
    # BUILD PREDICTION TABLE FROM MODEL OUTPUT
    # ============================================================

    month_map = pd.DataFrame({"Month.in.Quarter": [1, 2, 3], "Fiscal.Month": q_months})

    pred_long = pd.concat(
        [
            score_output[["SG_L03_desc", "RAW_PRED_M1"]]
            .rename(columns={"RAW_PRED_M1": "MODEL_VALUE"})
            .assign(**{"Month.in.Quarter": 1}),
            score_output[["SG_L03_desc", "RAW_PRED_M2"]]
            .rename(columns={"RAW_PRED_M2": "MODEL_VALUE"})
            .assign(**{"Month.in.Quarter": 2}),
            score_output[["SG_L03_desc", "RAW_PRED_M3"]]
            .rename(columns={"RAW_PRED_M3": "MODEL_VALUE"})
            .assign(**{"Month.in.Quarter": 3}),
        ],
        ignore_index=True,
    )
    pred_long = (
        pred_long.merge(month_map, on="Month.in.Quarter", how="left")
        .sort_values(["SG_L03_desc", "Month.in.Quarter"])
        .reset_index(drop=True)
    )

    # ============================================================
    # BUILD ACTUAL TABLE ON FULL GEO x MONTH GRID
    # ============================================================

    actual_long = pd.DataFrame(
        list(itertools.product(target_geos, [1, 2, 3])),
        columns=["SG_L03_desc", "Month.in.Quarter"],
    )
    actual_long = actual_long.merge(month_map, on="Month.in.Quarter", how="left")
    actual_long = actual_long.merge(
        source_actuals[["SG_L03_desc", "Month.in.Quarter", "ACTUAL_VALUE"]],
        on=["SG_L03_desc", "Month.in.Quarter"],
        how="left",
    )
    actual_long["ACTUAL_VALUE"] = np.where(
        actual_long["Month.in.Quarter"] <= latest_actual_miq,
        actual_long["ACTUAL_VALUE"].fillna(0),
        np.nan,
    )
    actual_long = actual_long.sort_values(["SG_L03_desc", "Month.in.Quarter"]).reset_index(drop=True)

    print("\n=== ACTUAL TABLE USED IN FINAL OUTPUT ===")
    print(actual_long)

    # ============================================================
    # COMBINE ACTUALS + MODEL PREDICTIONS
    # ============================================================

    raw_output = pd.DataFrame(
        list(itertools.product(target_geos, [1, 2, 3])),
        columns=["SG_L03_desc", "Month.in.Quarter"],
    )
    raw_output = raw_output.merge(month_map, on="Month.in.Quarter", how="left")
    raw_output = raw_output.merge(
        pred_long[["SG_L03_desc", "Month.in.Quarter", "MODEL_VALUE"]],
        on=["SG_L03_desc", "Month.in.Quarter"],
        how="left",
    )
    raw_output = raw_output.merge(
        actual_long[["SG_L03_desc", "Month.in.Quarter", "ACTUAL_VALUE"]],
        on=["SG_L03_desc", "Month.in.Quarter"],
        how="left",
    )
    raw_output["ROW_TYPE"] = np.where(raw_output["Month.in.Quarter"] <= latest_actual_miq, "ACTUAL", "FORECAST")
    raw_output = raw_output.sort_values(["SG_L03_desc", "Month.in.Quarter"]).reset_index(drop=True)

    print("\n=== RAW OUTPUT BEFORE FLASH ===")
    print(raw_output)

    # ============================================================
    # OPTIONAL FLASH OVERLAY
    # Applied to REMAINING quarter only
    # ============================================================

    if use_flash:
        flash_tbl = pd.read_csv(flash_file)
        flash_tbl.columns = [c.replace(" ", "_") for c in flash_tbl.columns]

        raw_output["_ACTUAL_FILLED"] = raw_output["ACTUAL_VALUE"].fillna(0)
        raw_output["_FORECAST_MODEL_VALUE"] = np.where(
            raw_output["ROW_TYPE"] == "FORECAST", raw_output["MODEL_VALUE"], 0
        )
        bridge_agg = raw_output.groupby("SG_L03_desc", as_index=False).agg(
            ACTUAL_TO_DATE=("_ACTUAL_FILLED", "sum"),
            MODEL_QTR_TOTAL=("MODEL_VALUE", "sum"),
            MODEL_REMAINING=("_FORECAST_MODEL_VALUE", "sum"),
        )
        raw_output = raw_output.drop(columns=["_ACTUAL_FILLED", "_FORECAST_MODEL_VALUE"])

        quarter_bridge = bridge_agg.merge(
            flash_tbl[["SG_L03_desc", "FLASH_QTR_TOTAL"]], on="SG_L03_desc", how="left"
        )
        quarter_bridge["GUIDE_REMAINING"] = quarter_bridge["FLASH_QTR_TOTAL"] - quarter_bridge["ACTUAL_TO_DATE"]

        lo = quarter_bridge["MODEL_REMAINING"] * (1 - flash_move_cap_pct)
        hi = quarter_bridge["MODEL_REMAINING"] * (1 + flash_move_cap_pct)
        clamped = quarter_bridge["GUIDE_REMAINING"].clip(lower=lo, upper=hi)

        quarter_bridge["FINAL_REMAINING"] = np.where(
            quarter_bridge["FLASH_QTR_TOTAL"].isna(),
            quarter_bridge["MODEL_REMAINING"],
            clamped,
        )
        quarter_bridge["FINAL_QTR_TOTAL"] = quarter_bridge["ACTUAL_TO_DATE"] + quarter_bridge["FINAL_REMAINING"]

        forecast_rows = raw_output[raw_output["ROW_TYPE"] == "FORECAST"].copy()
        raw_fcst_total = forecast_rows.groupby("SG_L03_desc")["MODEL_VALUE"].transform(lambda s: s.sum(skipna=True))
        count_per_geo = forecast_rows.groupby("SG_L03_desc")["MODEL_VALUE"].transform("size")
        forecast_rows["FCST_SHARE"] = np.where(
            raw_fcst_total == 0,
            1 / count_per_geo,
            forecast_rows["MODEL_VALUE"] / raw_fcst_total,
        )
        forecast_share_tbl = forecast_rows[["SG_L03_desc", "Month.in.Quarter", "FCST_SHARE"]]

        final_output = raw_output.merge(
            quarter_bridge[["SG_L03_desc", "FINAL_REMAINING"]], on="SG_L03_desc", how="left"
        ).merge(forecast_share_tbl, on=["SG_L03_desc", "Month.in.Quarter"], how="left")

        final_output["FINAL_VALUE"] = np.select(
            [final_output["ROW_TYPE"] == "ACTUAL", final_output["ROW_TYPE"] == "FORECAST"],
            [final_output["ACTUAL_VALUE"], final_output["FINAL_REMAINING"] * final_output["FCST_SHARE"]],
            default=final_output["MODEL_VALUE"],
        )

        final_output = (
            final_output[
                ["SG_L03_desc", "Fiscal.Month", "Month.in.Quarter", "ACTUAL_VALUE", "MODEL_VALUE", "FINAL_VALUE", "ROW_TYPE"]
            ]
            .sort_values(["SG_L03_desc", "Fiscal.Month"])
            .reset_index(drop=True)
        )

    else:
        raw_output["_ACTUAL_FILLED"] = raw_output["ACTUAL_VALUE"].fillna(0)
        raw_output["_FORECAST_MODEL_VALUE"] = np.where(
            raw_output["ROW_TYPE"] == "FORECAST", raw_output["MODEL_VALUE"], 0
        )
        quarter_bridge = raw_output.groupby("SG_L03_desc", as_index=False).agg(
            ACTUAL_TO_DATE=("_ACTUAL_FILLED", "sum"),
            MODEL_QTR_TOTAL=("MODEL_VALUE", "sum"),
            MODEL_REMAINING=("_FORECAST_MODEL_VALUE", "sum"),
        )
        raw_output = raw_output.drop(columns=["_ACTUAL_FILLED", "_FORECAST_MODEL_VALUE"])
        quarter_bridge["FLASH_QTR_TOTAL"] = np.nan
        quarter_bridge["GUIDE_REMAINING"] = np.nan
        quarter_bridge["FINAL_REMAINING"] = quarter_bridge["MODEL_REMAINING"]
        quarter_bridge["FINAL_QTR_TOTAL"] = quarter_bridge["MODEL_QTR_TOTAL"]

        final_output = raw_output.copy()
        final_output["FINAL_VALUE"] = np.where(
            final_output["ACTUAL_VALUE"].notna(), final_output["ACTUAL_VALUE"], final_output["MODEL_VALUE"]
        )
        final_output = (
            final_output[
                ["SG_L03_desc", "Fiscal.Month", "Month.in.Quarter", "ACTUAL_VALUE", "MODEL_VALUE", "FINAL_VALUE", "ROW_TYPE"]
            ]
            .sort_values(["SG_L03_desc", "Fiscal.Month"])
            .reset_index(drop=True)
        )

    # ============================================================
    # DIAGNOSTIC OUTPUT
    # ============================================================

    print("\n=== QUARTER BRIDGE ===")
    print(quarter_bridge)

    print("\n=== FINAL MONTHLY OUTPUT ===")
    print(final_output)

    print("\n=== GEO SUMMARY ===")
    geo_summary = (
        final_output.assign(_ACTUAL_FILLED=lambda d: d["ACTUAL_VALUE"].fillna(0))
        .groupby("SG_L03_desc", as_index=False)
        .agg(
            ACTUAL_TOTAL=("_ACTUAL_FILLED", "sum"),
            MODEL_TOTAL=("MODEL_VALUE", "sum"),
            FINAL_TOTAL=("FINAL_VALUE", "sum"),
        )
        .sort_values("FINAL_TOTAL", ascending=False)
        .reset_index(drop=True)
    )
    print(geo_summary)

    print("\n=== MONTH SUMMARY ===")
    month_summary = (
        final_output.assign(_ACTUAL_FILLED=lambda d: d["ACTUAL_VALUE"].fillna(0))
        .groupby("Fiscal.Month", as_index=False)
        .agg(
            ACTUAL_TOTAL=("_ACTUAL_FILLED", "sum"),
            MODEL_TOTAL=("MODEL_VALUE", "sum"),
            FINAL_TOTAL=("FINAL_VALUE", "sum"),
        )
        .sort_values("Fiscal.Month")
        .reset_index(drop=True)
    )
    print(month_summary)

    print("\n=== QUARTER SUMMARY ===")
    quarter_summary = pd.DataFrame(
        {
            "ACTUAL_TOTAL": [final_output["ACTUAL_VALUE"].fillna(0).sum()],
            "MODEL_TOTAL": [final_output["MODEL_VALUE"].sum(skipna=True)],
            "FINAL_TOTAL": [final_output["FINAL_VALUE"].sum(skipna=True)],
        }
    )
    print(quarter_summary)

    # ============================================================
    # OPTIONAL EXPORTS
    # ============================================================

    if save_outputs:
        final_output.to_csv(f"{output_prefix}_final_output.csv", index=False)
        geo_summary.to_csv(f"{output_prefix}_geo_summary.csv", index=False)
        month_summary.to_csv(f"{output_prefix}_month_summary.csv", index=False)
        quarter_bridge.to_csv(f"{output_prefix}_quarter_bridge.csv", index=False)
        source_actuals.to_csv(f"{output_prefix}_source_actuals.csv", index=False)

    return {
        "final_output": final_output,
        "geo_summary": geo_summary,
        "month_summary": month_summary,
        "quarter_summary": quarter_summary,
        "quarter_bridge": quarter_bridge,
        "source_actuals": source_actuals,
        "raw_output": raw_output,
    }


if __name__ == "__main__":
    main()
