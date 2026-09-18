# pyright: reportUnusedFunction=false
"""FastAPI delivery surface for the select-only model classifier."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path
import os
import threading
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from take_home_router.schemas import (
    HealthResponse,
    ModelCatalogResponse,
    RouteRequest,
    RouteResponse,
)
from take_home_router.service import ClassifierService, RoutingRequestError


def _frontend_path() -> Path:
    repository_path = Path(__file__).resolve().parents[2] / "frontend" / "index.html"
    if repository_path.is_file():
        return repository_path
    return Path(__file__).resolve().parent / "frontend" / "index.html"

_PUBLIC_LIMIT = 60
_PUBLIC_WINDOW = 60.0
_PUBLIC_MAX_PROMPT = 20_000
_public_hits: dict[str, list[float]] = {}
_public_lock = threading.Lock()


def _public_guard(request: Request, prompt_size: int | None = None) -> JSONResponse | None:
    """Apply a small single-instance abuse guard for the free public deployment."""
    if os.getenv("ROUTEFORGE_PUBLIC_MODE", "0") != "1":
        return None
    if prompt_size is not None and prompt_size > _PUBLIC_MAX_PROMPT:
        return JSONResponse(
            status_code=413,
            content={"detail": f"Public demo prompts are limited to {_PUBLIC_MAX_PROMPT:,} characters."},
        )
    client = request.client.host if request.client else "unknown"
    now = time.monotonic()
    with _public_lock:
        recent = [t for t in _public_hits.get(client, []) if now - t < _PUBLIC_WINDOW]
        if len(recent) >= _PUBLIC_LIMIT:
            _public_hits[client] = recent
            response = JSONResponse(
                status_code=429,
                content={"detail": "Rate limit reached. Please wait a minute and try again."},
            )
            response.headers["Retry-After"] = "60"
            return response
        recent.append(now)
        _public_hits[client] = recent
    return None


def create_app(service: ClassifierService | None = None) -> FastAPI:
    """Create an app, loading model artifacts exactly once during startup."""

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
        app.state.classifier_service = service or ClassifierService.from_environment()
        yield

    app = FastAPI(
        title="RouteForge — Intelligent Model Routing",
        version="1.0.0",
        summary="Classify a prompt into the generation model that should handle it.",
        description=(
            "A select-only API around the calibrated S2 classifier. It returns a model ID "
            "and never invokes a generation provider."
        ),
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:8000", "http://localhost:8000"],
        allow_origin_regex=r"^chrome-extension://[a-z]{32}$",
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["content-type"],
    )
    frontend_dir = _frontend_path().parent
    if frontend_dir.is_dir():
        app.mount("/frontend", StaticFiles(directory=frontend_dir), name="frontend")

    @app.get("/", include_in_schema=False)
    def frontend() -> FileResponse:
        frontend_path = _frontend_path()
        if not frontend_path.is_file():
            raise HTTPException(status_code=404, detail="frontend is not installed")
        return FileResponse(frontend_path)

    @app.get("/healthz", response_model=HealthResponse, tags=["operations"])
    def health(request: Request) -> HealthResponse:
        return _service(request).health()

    @app.get("/v1/models", response_model=ModelCatalogResponse, tags=["routing"])
    def models(request: Request) -> ModelCatalogResponse:
        return _service(request).catalog()

    @app.post(
        "/v1/route",
        response_model=RouteResponse,
        tags=["routing"],
        responses={422: {"description": "Invalid prompt or unsupported candidate model."}},
    )
    def route(payload: RouteRequest, request: Request) -> RouteResponse:
        guard = _public_guard(request, len(payload.prompt))
        if guard is not None:
            return guard  # type: ignore[return-value]
        try:
            return _service(request).route(payload)
        except RoutingRequestError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    return app


def _service(request: Request) -> ClassifierService:
    value = request.app.state.classifier_service
    if not isinstance(value, ClassifierService):
        raise RuntimeError("classifier service was not initialized")
    return value


app = create_app()

