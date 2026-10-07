# services/storage.py
import os
import uuid
from pathlib import Path
from app.core.config import settings

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".pdf", ".docx", ".pptx"}
MAX_SIZE = 5 * 1024 * 1024  # 5MB


class LocalStorage:
    def save(self, file_bytes: bytes, extension: str) -> str:
        if extension.lower() not in ALLOWED_EXTENSIONS:
            raise ValueError("File type not allowed")
        if len(file_bytes) > MAX_SIZE:
            raise ValueError("File too large")
        name = f"{uuid.uuid4().hex}{extension.lower()}"
        folder = Path(settings.LOCAL_STORAGE_DIR)
        folder.mkdir(parents=True, exist_ok=True)
        (folder / name).write_bytes(file_bytes)
        return f"/uploads/{name}"


# Future: class S3Storage / CloudinaryStorage implementing the same .save() interface
def get_storage():
    if settings.STORAGE_BACKEND == "local":
        return LocalStorage()
    raise ValueError(f"Unknown storage backend: {settings.STORAGE_BACKEND}")