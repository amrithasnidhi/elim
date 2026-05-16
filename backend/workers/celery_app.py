import os
from pathlib import Path
from celery import Celery
from celery.schedules import crontab
from dotenv import load_dotenv

# Load .env - check project root first, then backend folder
_root_env = Path(__file__).parent.parent.parent / ".env"
_backend_env = Path(__file__).parent.parent / ".env"
load_dotenv(_root_env)
load_dotenv(_backend_env)

celery_app = Celery(
    "elim",
    broker=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    backend=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    include=["workers.indexing", "workers.tts", "workers.spaced_rep_worker", "workers.peer_matching"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    result_expires=3600,
    beat_schedule={
        "spaced-rep-daily": {
            "task": "workers.spaced_rep_worker.send_reminders",
            "schedule": crontab(hour=8, minute=0),
        },
        "peer-matching-weekly": {
            "task": "workers.peer_matching.run_peer_matching",
            "schedule": crontab(day_of_week=1, hour=2, minute=0),
        },
        "peer-match-sweep": {
            "task": "workers.peer_matching.sweep_peer_queues",
            "schedule": crontab(minute="*/10"),
        },
    },
)
