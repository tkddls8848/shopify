from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from crawler.adapters import get_adapter
from crawler.core.fetch import FetchClient
from crawler.core.pipeline import Pipeline, validate_jsonl
from crawler.core.session import SessionStore

APP_ROOT = Path(__file__).resolve().parents[2]
REPOSITORY_ROOT = APP_ROOT.parents[1]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="crawler")
    subparsers = parser.add_subparsers(dest="command", required=True)

    login = subparsers.add_parser("login", help="log in and persist adapter cookies")
    login.add_argument("site")

    discover = subparsers.add_parser("discover", help="print discovered product URLs")
    discover.add_argument("site")
    discover.add_argument("--query", required=True)
    discover.add_argument("--limit", type=int)

    scrape = subparsers.add_parser("scrape", help="scrape one product to stdout")
    scrape.add_argument("site")
    scrape.add_argument("--url", required=True)

    run = subparsers.add_parser("run", help="discover and write validated JSONL")
    run.add_argument("site")
    run.add_argument("--query", required=True)
    run.add_argument("--limit", type=int)
    run.add_argument("--refresh", action="store_true")

    validate = subparsers.add_parser("validate", help="validate a JSONL file")
    validate.add_argument("path", type=Path)
    return parser


async def execute(args: argparse.Namespace) -> int:
    if args.command == "validate":
        valid, errors = validate_jsonl(args.path)
        print(json.dumps({"valid": valid, "invalid": len(errors), "errors": errors}, ensure_ascii=False, indent=2))
        return 1 if errors else 0

    adapter = get_adapter(args.site)
    session_store = SessionStore(APP_ROOT / ".sessions")
    async with FetchClient(
        cache_dir=APP_ROOT / ".cache" / adapter.site,
        minimum_interval=adapter.minimum_interval,
    ) as fetcher:
        session_store.restore(adapter.site, fetcher)
        pipeline = Pipeline(adapter, fetcher, APP_ROOT / "out", REPOSITORY_ROOT)

        if args.command == "login":
            await adapter.login(fetcher)
            path = session_store.save(adapter.site, fetcher)
            print(path)
        elif args.command == "discover":
            for url in await adapter.discover(fetcher, args.query, args.limit):
                print(url)
        elif args.command == "scrape":
            product = await pipeline.scrape(args.url)
            print(product.model_dump_json(indent=2))
        elif args.command == "run":
            run_dir, summary = await pipeline.run(args.query, args.limit, args.refresh)
            print(json.dumps({"runDir": str(run_dir), **summary.__dict__}, default=lambda value: value.__dict__, ensure_ascii=False, indent=2))
            return 1 if summary.failed else 0
    return 0


def main() -> None:
    raise SystemExit(asyncio.run(execute(build_parser().parse_args())))


if __name__ == "__main__":
    main()
