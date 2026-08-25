from crawler.adapters.base import Adapter
from crawler.adapters.demo import DemoAdapter


def get_adapter(site: str) -> Adapter:
    if site == "demo":
        return DemoAdapter()
    raise KeyError(f"unknown adapter: {site!r}; available adapters: demo")


__all__ = ["Adapter", "DemoAdapter", "get_adapter"]
