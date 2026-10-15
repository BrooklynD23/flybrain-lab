"""Tests for flybrain_pipeline.activity (T02.2)."""

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from jsonschema import Draft202012Validator

from flybrain_pipeline.activity import activity_info, bin_rates, quantize

SCHEMA_PATH = Path(__file__).resolve().parents[2] / "schemas" / "activity.schema.json"


def spikes_df(rows: list[tuple[float, int, int]]) -> pd.DataFrame:
    """Build a spikes frame in the Shiu parquet layout: t, trial, flywire_id."""
    return pd.DataFrame(rows, columns=["t", "trial", "flywire_id"])


def test_bin_rates_hand_computed_two_channels() -> None:
    # duration 200 ms, bin 50 ms -> 4 bins; 2 trials observed.
    channels = {"A": [1, 2], "B": [3]}
    spikes = spikes_df(
        [
            (10, 0, 1),
            (10, 0, 2),
            (60, 1, 1),
            (110, 0, 3),
            (10, 0, 999),  # unknown flywire_id: ignored
        ]
    )
    rates = bin_rates(spikes, channels, duration_ms=200, bin_ms=50)
    assert rates.dtype == np.float32
    assert rates.shape == (4, 2)
    # A: 2 neurons x 2 trials x 0.05 s -> counts 2,1 -> 10 Hz, 5 Hz.
    # B: 1 neuron  x 2 trials x 0.05 s -> count 1 in bin 2 -> 10 Hz.
    expected = np.array([[10, 0], [5, 0], [0, 10], [0, 0]], dtype=np.float32)
    np.testing.assert_array_equal(rates, expected)


def test_spike_at_bin_edge_goes_to_later_bin() -> None:
    spikes = spikes_df([(0, 0, 1), (50, 0, 1)])
    rates = bin_rates(spikes, {"A": [1]}, duration_ms=100, bin_ms=50)
    np.testing.assert_array_equal(rates, np.array([[20], [20]], dtype=np.float32))


def test_spikes_at_or_after_duration_dropped() -> None:
    spikes = spikes_df([(99, 0, 1), (100, 0, 1), (250, 0, 1)])
    rates = bin_rates(spikes, {"A": [1]}, duration_ms=100, bin_ms=50)
    np.testing.assert_array_equal(rates, np.array([[0], [20]], dtype=np.float32))


def test_empty_spikes_gives_zero_rates() -> None:
    spikes = spikes_df([])
    rates = bin_rates(spikes, {"A": [1]}, duration_ms=100, bin_ms=50)
    np.testing.assert_array_equal(rates, np.zeros((2, 1), dtype=np.float32))


def test_zero_neuron_channel_raises() -> None:
    spikes = spikes_df([(10, 0, 1)])
    with pytest.raises(ValueError, match="A"):
        bin_rates(spikes, {"A": [], "B": [1]}, duration_ms=100, bin_ms=50)


def test_non_divisible_duration_raises() -> None:
    spikes = spikes_df([(10, 0, 1)])
    with pytest.raises(ValueError, match="duration_ms"):
        bin_rates(spikes, {"A": [1]}, duration_ms=125, bin_ms=50)


def test_quantize_exact_bytes_bin_major() -> None:
    rates = np.array([[0, 30], [10, 0]], dtype=np.float32)  # [nBins, nChannels]
    data, max_hz = quantize(rates)
    # maxHz per channel; byte index = bin * nChannels + channel.
    assert max_hz == [pytest.approx(10.0), pytest.approx(30.0)]
    assert len(data) == 4
    assert list(data) == [0, 255, 255, 0]


def test_quantize_dequantize_error_within_step() -> None:
    rng = np.random.default_rng(0)
    rates = rng.uniform(0, 80, size=(20, 3)).astype(np.float32)
    rates[:, 1] = 0.0
    data, max_hz = quantize(rates)
    decoded = np.frombuffer(data, dtype=np.uint8).reshape(20, 3).astype(np.float64)
    for c in range(3):
        if max_hz[c] > 0:
            err = np.abs(decoded[:, c] / 255.0 * max_hz[c] - rates[:, c])
            assert err.max() <= max_hz[c] / 255.0 + 1e-6
        else:
            assert np.all(decoded[:, c] == 0)


def test_all_zero_channel_keeps_max_hz_zero() -> None:
    rates = np.array([[0, 5], [0, 5]], dtype=np.float32)
    data, max_hz = quantize(rates)
    assert max_hz[0] == 0.0
    assert max_hz[1] == pytest.approx(5.0)
    decoded = np.frombuffer(data, dtype=np.uint8).reshape(2, 2)
    assert np.all(decoded[:, 0] == 0)


def test_activity_info_matches_contract() -> None:
    channels = {"brain": [1, 2], "n_42": [3]}
    rates = np.array([[0, 0], [10, 40]], dtype=np.float32)
    info = activity_info("activity/walk.bin", channels, rates)
    assert info["binMs"] == 50
    assert info["encoding"] == "uint8-bin-major"
    assert info["nBins"] == 2
    assert info["channels"] == ["brain", "n_42"]
    assert info["maxHz"] == [pytest.approx(10.0), pytest.approx(40.0)]
    # Refinement the JSON Schema cannot express (see activity.ts).
    assert len(info["maxHz"]) == len(info["channels"])
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    Draft202012Validator(schema).validate(info)
