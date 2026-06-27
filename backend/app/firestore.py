import logging
from google.cloud import firestore
from google.cloud.firestore_v1.async_client import AsyncClient as AsyncFirestoreClient

logger = logging.getLogger(__name__)

_db: AsyncFirestoreClient | None = None


def get_firestore_client() -> AsyncFirestoreClient:
    global _db
    if _db is None:
        from app.config import settings
        _db = firestore.AsyncClient(
            project=settings.gcp_project,
            database=settings.firestore_database,
        )
        logger.info("Firestore client initialized (database: %s)", settings.firestore_database)
    return _db


async def get_db():
    """Dependency for FastAPI - yields the Firestore client."""
    yield get_firestore_client()
