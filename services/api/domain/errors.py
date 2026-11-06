"""Domain errors. Services raise these; main.py maps them to RFC 9457 responses.

Each error has a stable `code` that clients can switch on. Never put an account id
or internal detail in `detail` (INV-01).
"""


class DomainError(Exception):
    """Base class. status: HTTP status; code: stable machine string."""

    status: int = 400
    code: str = "error"

    def __init__(self, detail: str = "", *, retry_after: int | None = None, fields: dict | None = None):
        super().__init__(detail or self.code)
        self.detail = detail or self.code
        self.retry_after = retry_after
        self.fields = fields or {}


class NotFound(DomainError):
    status, code = 404, "not_found"


class Forbidden(DomainError):
    status, code = 403, "forbidden"


class InvalidTransition(DomainError):
    status, code = 409, "invalid_transition"


class Conflict(DomainError):
    status, code = 409, "conflict"


class StaleVersion(DomainError):
    status, code = 412, "stale_version"


class ValidationFailed(DomainError):
    status, code = 422, "validation_failed"


class RateLimited(DomainError):
    status, code = 429, "rate_limited"


class Unavailable(DomainError):
    status, code = 503, "unavailable"


class NotBuilt(DomainError):
    """Route or service exists in the spec and is not implemented yet."""

    status, code = 501, "not_built"
