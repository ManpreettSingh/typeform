"""Domain errors and the handlers that render every error as `{"detail": ...}` (API_SPEC.md)."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError

logger = logging.getLogger(__name__)


class AppError(Exception):
    status_code = 400

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class NotFoundError(AppError):
    status_code = 404


class BadRequestError(AppError):
    status_code = 400


class ConflictError(AppError):
    status_code = 409


class BadGatewayError(AppError):
    status_code = 502


class ServiceUnavailableError(AppError):
    status_code = 503


class FieldValidationError(Exception):
    """422 with `{"detail": {"errors": {"<field or question id>": "msg"}}}`."""

    def __init__(self, errors: dict[str, str]):
        super().__init__(errors)
        self.errors = errors


def _format_loc(loc: tuple[str | int, ...]) -> str:
    # Drop the request-part prefix FastAPI adds ("body", "path", "query").
    parts = loc[1:] if loc and loc[0] in ("body", "path", "query") else loc
    return ".".join(str(p) for p in parts) or "body"


def _format_msg(msg: str) -> str:
    return msg.removeprefix("Value error, ")


def errors_from_pydantic(exc: ValidationError, prefix: str = "") -> dict[str, str]:
    errors: dict[str, str] = {}
    for err in exc.errors():
        key = ".".join(str(p) for p in (prefix, *err["loc"]) if p != "")
        errors.setdefault(key or prefix or "body", _format_msg(err["msg"]))
    return errors


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})

    @app.exception_handler(FieldValidationError)
    async def _field_error(_: Request, exc: FieldValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": {"errors": exc.errors}})

    @app.exception_handler(RequestValidationError)
    async def _request_validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors: dict[str, str] = {}
        for err in exc.errors():
            errors.setdefault(_format_loc(tuple(err["loc"])), _format_msg(err["msg"]))
        return JSONResponse(status_code=422, content={"detail": {"errors": errors}})

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error", exc_info=exc)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})
