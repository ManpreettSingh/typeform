import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  (registers tables on Base.metadata)
from app.core.config import get_settings
from app.core.db import Base, engine, migrate
from app.core.errors import register_exception_handlers
from app.routers import ai, forms, health, public, questions, responses, endings, media, templates, themes, workspaces

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    Base.metadata.create_all(engine)
    migrate()
    if get_settings().seed_demo_data:
        from app.seed import seed

        forms, responses, themes = seed()
        logger.info("Demo data: %d new form(s), %d response(s), %d theme(s).", forms, responses, themes)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Typeform Clone API", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)

    # templates.router goes before forms.router so POST /forms/from-template/{slug} is never read as /forms/{form_id}/...
    for router in (health.router, templates.router, forms.router, questions.router, public.router, responses.router, ai.router, endings.router, media.router, themes.router, workspaces.router):
        app.include_router(router, prefix=settings.api_prefix)
    return app


app = create_app()
