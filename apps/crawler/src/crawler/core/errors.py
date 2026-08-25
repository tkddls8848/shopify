class CrawlerError(Exception):
    """Base class for expected crawler failures."""


class FetchError(CrawlerError):
    pass


class ParseError(CrawlerError):
    pass


class AuthenticationError(CrawlerError):
    pass
