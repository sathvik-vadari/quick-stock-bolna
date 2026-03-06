"""QuickStock — AI Voice Store Availability Checker."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.helpers.config import Config
from app.helpers.logger import setup_logger
from app.db.connection import init_db
from app.routes import ticket_routes, bolna_webhook

logger = setup_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("QuickStock backend started")
    yield
    logger.info("QuickStock backend shutting down")


app = FastAPI(
    title="QuickStock",
    description="AI Voice Store Availability Checker — powered by Bolna",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ticket_routes.router)
app.include_router(bolna_webhook.router)


@app.get("/")
async def root():
    return {
        "service": "QuickStock",
        "description": "AI Voice Store Availability Checker",
        "version": "1.0.0",
        "endpoints": {
            "create_ticket": "POST /api/ticket",
            "get_ticket": "GET /api/ticket/{ticket_id}",
            "get_options": "GET /api/ticket/{ticket_id}/options",
            "bolna_webhook": "POST /api/bolna/webhook",
        },
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


def main():
    logger.info("Starting QuickStock")
    uvicorn.run(
        "app.main:app",
        host=Config.SERVER_HOST,
        port=Config.SERVER_PORT,
        reload=True,
        log_level=Config.LOG_LEVEL.lower(),
    )


if __name__ == "__main__":
    main()
