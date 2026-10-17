"""Measure a local model on the device BEFORE choosing one.

Usage: python -m campuscart_edge.benchmark http://localhost:8080/v1 <model> [runs]
Reports latency and the peak resident memory of this process plus the system's free memory;
also watch the inference server's own RSS (e.g. `ps -o rss,cmd -C llama-server`).
"""
import asyncio
import resource
import statistics
import sys
import time

import httpx

PROMPT = "Summarise: 3 open orders (2x samosa, 1x chai, 4x brownie). Which first?"


def free_mem_mb() -> float:
    with open("/proc/meminfo") as f:
        for line in f:
            if line.startswith("MemAvailable"):
                return int(line.split()[1]) / 1024
    return -1.0


async def main(url: str, model: str, runs: int) -> None:
    times: list[float] = []
    async with httpx.AsyncClient(timeout=300) as c:
        for _ in range(runs):
            t = time.perf_counter()
            r = await c.post(f"{url.rstrip('/')}/chat/completions", json={
                "model": model, "max_tokens": 128,
                "messages": [{"role": "user", "content": PROMPT}]})
            r.raise_for_status()
            times.append(time.perf_counter() - t)
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
    print(f"runs={runs} median={statistics.median(times):.1f}s max={max(times):.1f}s")
    print(f"client_peak_rss={peak:.0f}MB system_available={free_mem_mb():.0f}MB")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    asyncio.run(main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 5))
