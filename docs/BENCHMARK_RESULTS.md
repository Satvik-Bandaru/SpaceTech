# Reproducible synthetic demonstration

2026-10-28, spacecraft-reference-v0.2, Python 3.12.8 on arm64. Scenario: `scenarios/engineering_multifault.json`. Training seed 9001; evaluation seeds 0–4. Saved evidence: `examples/engineering-benchmark.json`, including source hashes and descriptive variation.

Five-seed closed-loop means:

| Metric | Baseline | Assisted |
| --- | ---: | ---: |
| Time in safe mode (seconds) | 2070 | 2970 |
| Minimum stored battery (%) | 39.1628 | 57.5129 |
| Peak node temperature (K) | 304.5542 | 299.9653 |
| Unserved demand (Wh) | 0 | 0 |

Assistance trades longer safe-mode operation for higher retained charge and lower peak temperature in this particular synthetic case. This is not evidence of general AI superiority or flight accuracy.

On identical baseline-controlled telemetry replay, mean fault-channel true-positive samples were 134 versus 539.8; false-negative samples were 467 versus 61.2; both had zero false positives in these five runs. Mean missed injected episodes were 2 versus 0.2. Synthetic training resembles the test plant; these are narrow reproducibility results, not independently validated diagnostic accuracy.

The seed-7 single demonstration reported no conservation violations for either controller. All 46 tests passed, including the original 16. Independent review led to regression coverage for powerless-radio availability and adjacent fault-window attribution. Repeated complete reports and the saved five-seed benchmark matched exactly. The legacy handoff matched the pre-change baseline byte-for-byte. All 22 original ZIP members remain unchanged in Downloads.

Re-run from the project root:

```bash
python3 -m unittest discover -s tests -v
python3 benchmark_engineering.py scenarios/engineering_multifault.json --seeds 0 1 2 3 4 --out artifacts/engineering-benchmark.json
```

See `ENGINEERING_ASSUMPTIONS.md` for equations, label definitions, release gates and unimplemented work.
