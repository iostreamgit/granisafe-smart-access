"""Map model labels to canonical AI wire classes used by Core API.

`best.pt` / Construction Site Safety style names include Hardhat, Safety Vest,
and NO-* absence classes. Absence labels intentionally do not map (fail-closed
via missing positive detection). There is no dedicated Uniform class; Person is
used as a presence proxy so Core policy can still evaluate UNIFORM.
"""

from __future__ import annotations

CANONICAL = ("helmet", "safety_vest", "uniform")

_LABEL_MAP: dict[str, str] = {
    "helmet": "helmet",
    "hardhat": "helmet",
    "hard_hat": "helmet",
    "safety_helmet": "helmet",
    "safety_vest": "safety_vest",
    "vest": "safety_vest",
    "safetyvest": "safety_vest",
    "uniform": "uniform",
    "workwear": "uniform",
    # Construction Site Safety checkpoint has no workwear class.
    "person": "uniform",
}


def to_canonical(label: str) -> str | None:
    key = label.strip().lower().replace("-", "_").replace(" ", "_")
    # Explicit absence classes from common PPE datasets — never treat as present.
    if key.startswith("no_") or key.startswith("without_"):
        return None
    return _LABEL_MAP.get(key)
