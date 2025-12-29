"""
Standalone worker process for running the ingestion scheduler.
Useful for deployments that keep the scheduler separate from the API process.
"""
import asyncio
import logging

from .scheduler import ingestion_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    """
    Start the scheduler loop and keep it running until interrupted.

    Side Effects:
        Starts APScheduler and manages an asyncio event loop.
    """
    ingestion_scheduler.start()
    logger.info("Ingestion worker started.")
    loop = asyncio.get_event_loop()
    try:
        loop.run_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down ingestion worker...")
    finally:
        ingestion_scheduler.shutdown()


if __name__ == "__main__":
    main()
