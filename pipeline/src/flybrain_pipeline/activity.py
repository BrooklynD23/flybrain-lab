"""Bin simulated spikes into per-channel firing rates and quantize to uint8.

Output contract: ``src/contracts/activity.ts`` (ActivityInfo). The binary asset
is ``uint8-bin-major``: byte index = ``bin * n_channels + channel``, decoded as
``byte / 255 * maxHz[channel]`` Hz.
"""

import numpy as np
import pandas as pd

BIN_MS = 50
ENCODING = "uint8-bin-major"


def bin_rates(
    spikes: pd.DataFrame,
    channels: dict[str, list[int]],
    duration_ms: int,
    bin_ms: int = BIN_MS,
) -> np.ndarray:
    """Mean firing rate in Hz per bin and channel, float32 ``[nBins, nChannels]``.

    ``spikes`` uses the Shiu parquet layout: columns ``t`` (ms), ``trial`` and
    ``flywire_id``. Each channel's rate is
    ``spike_count / (n_neurons * n_trials * bin_s)``, where ``n_trials`` is the
    number of distinct trials in ``spikes`` (empty input yields zeros). Spikes
    at an exact bin edge fall into the later bin; spikes outside
    ``[0, duration_ms)`` and spikes from flywire_ids in no channel are dropped.

    Raises ``ValueError`` for a channel with zero neurons, or when
    ``duration_ms`` is not a positive multiple of ``bin_ms``.
    """
    if duration_ms <= 0 or bin_ms <= 0 or duration_ms % bin_ms != 0:
        raise ValueError(
            f"duration_ms ({duration_ms}) must be a positive multiple of bin_ms ({bin_ms})"
        )
    empty = [name for name, ids in channels.items() if len(ids) == 0]
    if empty:
        raise ValueError(f"channels with zero neurons: {empty}")

    n_bins = duration_ms // bin_ms
    n_trials = max(int(spikes["trial"].nunique()), 1)
    rates = np.zeros((n_bins, len(channels)), dtype=np.float64)
    if spikes.empty:
        return rates.astype(np.float32)

    t = spikes["t"].to_numpy(dtype=np.float64)
    bin_index = np.floor(t / bin_ms).astype(np.int64)
    in_range = (bin_index >= 0) & (bin_index < n_bins)
    flywire_ids = spikes["flywire_id"].to_numpy()
    bin_s = bin_ms / 1000.0

    for c, neuron_ids in enumerate(channels.values()):
        mask = in_range & np.isin(flywire_ids, list(neuron_ids))
        counts = np.bincount(bin_index[mask], minlength=n_bins)
        rates[:, c] = counts / (len(neuron_ids) * n_trials * bin_s)
    return rates.astype(np.float32)


def quantize(rates: np.ndarray) -> tuple[bytes, list[float]]:
    """Per-channel-max quantize rates to uint8 in bin-major byte order.

    Returns ``(data, max_hz)`` where ``data`` has ``nBins * nChannels`` bytes
    (byte index = ``bin * n_channels + channel``) and ``max_hz`` holds each
    channel's maximum rate. A channel whose max is 0 keeps ``maxHz == 0`` and
    all-zero bytes.
    """
    rates = np.asarray(rates, dtype=np.float32)
    max_hz = rates.max(axis=0)
    out = np.zeros(rates.shape, dtype=np.uint8)
    for c in range(rates.shape[1]):
        m = float(max_hz[c])
        if m > 0:
            out[:, c] = np.rint(rates[:, c] / m * 255.0).astype(np.uint8)
    return out.tobytes(), [float(v) for v in max_hz]


def activity_info(url: str, channels: dict[str, list[int]], rates: np.ndarray) -> dict:
    """Build the ActivityInfo contract dict for a rates array."""
    rates = np.asarray(rates)
    max_hz = rates.max(axis=0) if rates.size else np.zeros(rates.shape[1])
    return {
        "url": url,
        "binMs": BIN_MS,
        "nBins": int(rates.shape[0]),
        "channels": list(channels.keys()),
        "maxHz": [float(v) for v in max_hz],
        "encoding": ENCODING,
    }
