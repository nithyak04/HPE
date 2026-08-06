# Revenue Forecast v2 — Python translation

`revenue_forecast_v2.py` is a Python port of the R script
`Upgraded_Rev_Model_FINAL.R` (Geo-Only Revenue Forecast, Version 2 —
Monthly ML Snapshot Model). It's a line-by-line translation intended to
reproduce the R script's logic and outputs, not a redesign.

## What the model does

For a given "production" fiscal year/quarter, it forecasts the remaining
months of that quarter per geo, using three XGBoost snapshot models
trained on quarter-lag/trend/seasonality features:

- **Snapshot 0** — no months of the target quarter are loaded yet →
  predicts M1, M2, M3.
- **Snapshot 1** — M1 is loaded → predicts M2, M3.
- **Snapshot 2** — M1 + M2 are loaded → predicts M3.

Each model regresses `log1p(revenue)` on the feature set below,
weighted by recency (`recency_decay ^ quarters_since_latest`, floored at
`min_recency_weight`), then back-transforms with `expm1`.

Actual months are always passed straight through in the output; only
the still-open months are model-predicted. An optional "flash" file
(quarter-level guidance per geo) can nudge the *remaining* forecast for
each geo — never already-actual months — capped at
± `flash_move_cap_pct` of the model's own remaining-quarter estimate.

## Usage

```bash
pip install -r requirements.txt
python revenue_forecast_v2.py
```

Edit `DEFAULT_CONFIG` at the top of `revenue_forecast_v2.py` to point at
your input files and settings — mirrors the R script's `SETTINGS`
section:

| Key | R equivalent | Meaning |
|---|---|---|
| `file_path` | `file_path` | Source actuals CSV |
| `value_col` | `value_col` | Which column in the source CSV holds revenue (e.g. `"FLASH"`) |
| `prod_year`, `prod_qtr` | same | The quarter being forecast |
| `target_geos` | same | Geo list (also the factor levels used for one-hot encoding) |
| `use_flash`, `flash_file`, `flash_move_cap_pct` | same | Flash overlay controls |
| `save_outputs`, `output_prefix` | same | Whether/where to write CSV outputs |
| `xgb_*` | same | XGBoost hyperparameters |
| `recency_decay`, `min_recency_weight` | same | Recency weighting |

Alternatively, import and call it with your own config, without editing
the file:

```python
from revenue_forecast_v2 import main

results = main(config={
    "file_path": "FY26 Model rdata Rev FY22_FY26.csv",
    "flash_file": "geo_flash_qtr.csv",
    "prod_year": 2026,
    "prod_qtr": 3,
})

final_output = results["final_output"]   # per-geo, per-month actual/model/final
geo_summary  = results["geo_summary"]
month_summary = results["month_summary"]
quarter_summary = results["quarter_summary"]
quarter_bridge = results["quarter_bridge"]
```

`main()` prints the same diagnostic tables the R script does (target
quarter status, source actuals, raw output, quarter bridge, final
output, geo/month/quarter summaries) and returns them as a dict of
DataFrames instead of relying on `save_outputs`/side-effect CSVs, though
`save_outputs=True` still writes the same five CSV files the R script
does (`*_final_output.csv`, `*_geo_summary.csv`, `*_month_summary.csv`,
`*_quarter_bridge.csv`, `*_source_actuals.csv`).

## Notes on the translation

The logic matches the R script step for step — same feature set, same
snapshot structure, same coalesce/default rules, same flash-cap math.
A few things changed mechanically because R and Python don't share
primitives, though behavior should be equivalent:

- **`model.matrix()` → `pandas.get_dummies()`.** R's formula interface
  one-hot encodes `SG_L03_desc` and `QuarterF` with the first factor
  level dropped (treatment contrasts) and no intercept column; the
  Python version reproduces that with `drop_first=True` dummy columns
  for both, concatenated with the numeric features. Column *names*
  differ (R's `model.matrix` glues level onto the variable name; Python
  uses a `SG_L03_desc_<level>` / `QuarterF_<level>` prefix), but this
  doesn't matter since the model is retrained from scratch in Python —
  nothing depends on matching R's literal column names.
- **`xgboost()` (R) → `xgb.train()` with a `DMatrix`** (Python), same
  hyperparameters (`max_depth`, `eta`, `subsample`, `colsample_bytree`,
  `min_child_weight`, `objective="reg:squarederror"`, `nrounds` →
  `num_boost_round`), same per-row `RECENCY_WT` sample weights.
- **`dplyr::lag()` inside `group_by() %>% arrange()`** → sort the frame
  by `(SG_L03_desc, Fiscal.Year, Quarter)` once, then
  `groupby("SG_L03_desc")[...].shift(n)`.
- **`coalesce()`** → chained `.fillna(...)`, applied in the same order
  (this matters for `ROLL2_QTR`/`ROLL4_QTR`, which fall back to
  already-defaulted columns).
- **XGBoost's R and Python packages use different RNGs/thread
  scheduling even with identical hyperparameters**, so forecasts will be
  numerically close to the R script's output but not bit-for-bit
  identical. Validate side by side against a known R run before relying
  on this for reporting.

## Validation performed

The R script references two input files (`FY26 Model rdata Rev
FY22_FY26.csv` and `geo_flash_qtr.csv`) that aren't in this repo, so the
translation was smoke-tested against synthetic data covering all code
paths instead of the real dataset:

- Snapshot 0 (no months of the target quarter loaded)
- Snapshot 1 (M1 loaded)
- Snapshot 2 (M1 + M2 loaded, including quarters that are already fully
  actual)
- Flash overlay on and off

All four ran end-to-end without errors and produced sane, internally
consistent output (actuals passed through unchanged, forecasts within
the flash cap, summaries reconciling to the monthly detail). **Before
using this for real reporting, run it against your actual source files
and compare totals against the R script's output for at least one
historical quarter.**
