from app.services.label_adapter import to_canonical


def test_maps_aliases():
    assert to_canonical("helmet") == "helmet"
    assert to_canonical("HardHat") == "helmet"
    assert to_canonical("Hardhat") == "helmet"
    assert to_canonical("vest") == "safety_vest"
    assert to_canonical("Safety Vest") == "safety_vest"
    assert to_canonical("safety-vest") == "safety_vest"
    assert to_canonical("uniform") == "uniform"
    assert to_canonical("unknown") is None
    assert to_canonical("NO-Hardhat") is None
    assert to_canonical("NO-Safety Vest") is None
    assert to_canonical("Person") == "uniform"
