#!/usr/bin/env python3
import asyncio
import json
import random
from dataclasses import dataclass

POLL_SECONDS = 10
MAX_GH_RETRIES = 5
BASE_GH_BACKOFF_SECONDS = 2


@dataclass
class PrInfo:
    number: int
    url: str
    head_sha: str
    mergeable: str | None
    merge_state: str | None


class RateLimitError(RuntimeError):
    pass


def is_rate_limit_error(error: str) -> bool:
    return "HTTP 429" in error or "rate limit" in error.lower()


async def run_gh(*args: str) -> str:
    max_delay = BASE_GH_BACKOFF_SECONDS * (2 ** (MAX_GH_RETRIES - 1))
    delay_seconds = BASE_GH_BACKOFF_SECONDS
    last_error = "gh command failed"
    for attempt in range(1, MAX_GH_RETRIES + 1):
        proc = await asyncio.create_subprocess_exec(
            "gh",
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode == 0:
            return stdout.decode()
        error = stderr.decode().strip() or "gh command failed"
        if not is_rate_limit_error(error):
            raise RuntimeError(error)
        last_error = error
        if attempt >= MAX_GH_RETRIES:
            break
        jitter = random.uniform(0, delay_seconds)
        await asyncio.sleep(min(delay_seconds + jitter, max_delay))
        delay_seconds = min(delay_seconds * 2, max_delay)
    raise RateLimitError(last_error)


async def get_pr_info() -> PrInfo:
    data = await run_gh(
        "pr",
        "view",
        "--json",
        "number,url,headRefOid,mergeable,mergeStateStatus",
    )
    parsed = json.loads(data)
    return PrInfo(
        number=parsed["number"],
        url=parsed["url"],
        head_sha=parsed["headRefOid"],
        mergeable=parsed.get("mergeable"),
        merge_state=parsed.get("mergeStateStatus"),
    )


async def get_check_runs(head_sha: str) -> list[dict]:
    data = await run_gh(
        "api",
        "--method",
        "GET",
        f"repos/{{owner}}/{{repo}}/commits/{head_sha}/check-runs",
    )
    payload = json.loads(data)
    return payload.get("check_runs", [])


def summarize_checks(check_runs: list[dict]) -> tuple[bool, bool]:
    if not check_runs:
      return True, False
    pending = False
    failed = False
    for check in check_runs:
        status = check.get("status")
        conclusion = check.get("conclusion")
        if status != "completed":
            pending = True
            continue
        if conclusion not in ("success", "skipped", "neutral"):
            failed = True
    return pending, failed


async def main() -> int:
    while True:
        info = await get_pr_info()
        if info.mergeable == "CONFLICTING":
            print("PR is conflicting with main.")
            return 1
        checks = await get_check_runs(info.head_sha)
        pending, failed = summarize_checks(checks)
        if failed:
            print("PR checks failed.")
            return 3
        if not pending:
            print("PR checks are complete.")
            return 0
        await asyncio.sleep(POLL_SECONDS)


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
