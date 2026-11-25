# services/storage.py
import uuid
from pathlib import Path
from app.core.config import settings

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".pdf", ".docx", ".pptx"}
MAX_SIZE = 5 * 1024 * 1024  # 5MB

# Voice notes (Chrome/Android record webm, Safari/iOS record m4a, Firefox records ogg)
AUDIO_EXTENSIONS = {".webm", ".ogg", ".m4a", ".aac", ".mp3", ".wav"}
AUDIO_MAX_SIZE = 10 * 1024 * 1024  # 10MB, plenty for 5 minutes of voice


class LocalStorage:
    def save(self, file_bytes: bytes, extension: str, kind: str = "file") -> str:
        """kind="file" keeps the old rules; kind="audio" allows voice-note formats."""
        if kind == "audio":
            allowed, limit = AUDIO_EXTENSIONS, AUDIO_MAX_SIZE
        else:
            allowed, limit = ALLOWED_EXTENSIONS, MAX_SIZE
        if extension.lower() not in allowed:
            raise ValueError("File type not allowed")
        if len(file_bytes) > limit:
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