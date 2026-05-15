# MA289 Project 3: Applied Demonstration of Regularization

**CDT Zander Bos | Major Kuiper | MA289: Intro to Statistical Learning | April 2026**

---

## Overview

This project demonstrates the necessity and effectiveness of regularization
in linear regression. Using both a synthetic dataset and the sklearn diabetes
dataset, it compares Ordinary Least Squares (OLS), Ridge regression, Lasso
regression, and Best Subset Selection to show how regularization improves
generalization when features are correlated and not all of them carry
meaningful signal.

---

## Repository Contents

- `Bos_Zander_MA289_Project_3_Presentation_IPYNB_FILE.ipynb` — Main Google Colab notebook containing all code, figures, and analysis
- `Bos_Zander_MA289_Project_3_Overleaf_Write-Up.pdf` — Technical report
- `MA289_Project3_DAAW_Acknowledgment.pdf` — Documentation of AI assistance per USMA DAAW guidelines

---

## Methods Compared

- **OLS** — Unregularized baseline, minimizes residual sum of squares
- **Ridge (L2)** — Shrinks all coefficients toward zero, retains all features
- **Lasso (L1)** — Zeroes out weak features, performs automatic variable selection
- **Best Subset Selection** — Exhaustive search across all 1,023 feature combinations, evaluated using AIC and BIC

---

## Datasets

**Synthetic:** 150 samples, 50 features, 5 truly informative with known
coefficients, 45 pure noise, moderate inter-feature correlation (ρ=0.4).
Designed to stress test OLS.

**Real:** sklearn diabetes dataset. 442 patients, 10 clinical features
(age, sex, BMI, blood pressure, and six serum measurements). Target y
is a continuous disease progression score ranging 25–346. Source: Efron
et al. (2004), *Annals of Statistics*.

---

## Key Results

| Method | Test MSE | Features Used |
|--------|----------|---------------|
| OLS | 2900 | 10 / 10 |
| Ridge (λ=40.555) | 2858 | 10 / 10 |
| Best Subset (AIC & BIC) | 2846 | 6 / 10 |
| Lasso (λ=1.589) | 2801 | 7 / 10 |

Lasso achieved the lowest test MSE. Best Subset matched closely using
one fewer feature, confirming that Lasso approximated exhaustive search
without evaluating all 1,023 combinations.

---

## How to Run

1. Open the notebook in Google Colab:
   - Go to [colab.research.google.com](https://colab.research.google.com)
   - Select **File > Open notebook > GitHub**
   - Paste the repository URL and select the `.ipynb` file

2. Run all cells in order:
   - **Runtime > Run all**
   - All required libraries (numpy, matplotlib, sklearn, statsmodels) are
     available in Colab by default — no additional installation needed

3. Expected runtime: approximately 1–2 minutes for Best Subset Selection
   to evaluate all 1,023 combinations

---

## Dependencies
All available by default in Google Colab.

---

## References

- Efron, B., Hastie, T., Johnstone, I., & Tibshirani, R. (2004). Least Angle Regression. *Annals of Statistics*, 32(2), 407–499.
- James, G., Witten, D., Hastie, T., & Tibshirani, R. (2021). *An Introduction to Statistical Learning*. 2nd ed. Springer.
- Tibshirani, R. (1996). Regression Shrinkage and Selection via the Lasso. *Journal of the Royal Statistical Society: Series B*, 58(1), 267–288.
- Hoerl, A. E., & Kennard, R. W. (1970). Ridge Regression: Biased Estimation for Nonorthogonal Problems. *Technometrics*, 12(1), 55–67.

---

## AI Assistance

This project was developed with assistance from Anthropic's Claude (claude.ai)
per USMA DAAW guidelines. Full documentation of AI use is included in
`MA289_Project3_DAAW_Acknowledgment.pdf` and available at:
https://claude.ai/share/335d389e-70ff-4fc3-9405-c3dfbb5e0d46
