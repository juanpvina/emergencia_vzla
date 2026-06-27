from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Google Cloud
    gcp_project: str = ""
    firestore_database: str = "(default)"
    storage_bucket: str = ""

    # Motor de extracción para imágenes
    # Opciones:
    #   "gemini"         - Gemini Vision (requiere GEMINI_API_KEY)
    #   "vision"         - Cloud Vision OCR + parser rule-based (gratis 1000/mes)
    #   "vision+gemini"  - Cloud Vision OCR + Gemini estructura texto
    extraction_engine: str = "gemini"

    # Admin panel
    admin_password: str = "admin"

    # Google Gemini (solo necesario si extraction_engine incluye "gemini")
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash-lite"
    gemini_temperature: float = 0.1
    gemini_max_tokens: int = 8192

    # Archivos
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 20

    # CORS
    cors_origins: str = "*"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
