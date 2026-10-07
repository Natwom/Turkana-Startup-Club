import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ directory (config.py lives in backend/app/core/)
BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    # Absolute path, so .env is found no matter where uvicorn is launched from
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    DATABASE_URL: str = "sqlite:///./tsc.db"
    JWT_SECRET: str = "dev-secret"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:5174"
    STORAGE_BACKEND: str = "local"
    LOCAL_STORAGE_DIR: str = "./uploads"
    SUPER_ADMIN_EMAIL: str = "admin@tsc.africa"
    SUPER_ADMIN_PASSWORD: str = "ChangeMe123!"
    FRONTEND_URL: str = "http://localhost:5173"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()

# Make sure the upload folder exists before main.py mounts it as static files
if settings.STORAGE_BACKEND == "local":
    os.makedirs(settings.LOCAL_STORAGE_DIR, exist_ok=True)