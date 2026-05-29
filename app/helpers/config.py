"""Configuration — loads from .env."""
import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv(".env", override=True)


class Config:
    # Server
    SERVER_HOST: str = os.getenv("SERVER_HOST", "0.0.0.0")
    SERVER_PORT: int = int(os.getenv("PORT", os.getenv("SERVER_PORT", "8000")))

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_DIR: str = os.getenv("LOG_DIR", "logs")

    # Database (PostgreSQL)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/quickstock",
    )

    # Azure OpenAI
    AZURE_OPENAI_API_KEY: Optional[str] = os.getenv("AZURE_OPENAI_API_KEY")
    AZURE_OPENAI_ENDPOINT: str = os.getenv(
        "AZURE_OPENAI_ENDPOINT",
        "https://az-openai-shared.openai.azure.com/",
    )
    AZURE_OPENAI_API_VERSION: str = os.getenv(
        "AZURE_OPENAI_API_VERSION", "2025-04-01-preview"
    )
    AZURE_OPENAI_DEPLOYMENT: str = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")

    # Google Maps
    GOOGLE_MAPS_API_KEY: Optional[str] = os.getenv("GOOGLE_MAPS_API_KEY")

    # Google Gemini
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-flash-latest")

    # Bolna (voice AI — outbound calls)
    BOLNA_API_KEY: Optional[str] = os.getenv("BOLNA_API_KEY")
    BOLNA_AGENT_ID: Optional[str] = os.getenv("BOLNA_AGENT_ID")
    BOLNA_SERVER_URL: Optional[str] = os.getenv("BOLNA_SERVER_URL")

    # Telephony provider for DTMF (used to send keypad tones during IVR navigation)
    # Supported: "twilio" or "plivo" — must match the provider connected to Bolna
    TELEPHONY_PROVIDER: str = os.getenv("TELEPHONY_PROVIDER", "plivo")
    TWILIO_ACCOUNT_SID: Optional[str] = os.getenv("TWILIO_ACCOUNT_SID")
    TWILIO_AUTH_TOKEN: Optional[str] = os.getenv("TWILIO_AUTH_TOKEN")
    PLIVO_AUTH_ID: Optional[str] = os.getenv("PLIVO_AUTH_ID")
    PLIVO_AUTH_TOKEN: Optional[str] = os.getenv("PLIVO_AUTH_TOKEN")

    # Shared secret for authenticating Bolna custom function calls to our DTMF endpoint
    DTMF_API_TOKEN: Optional[str] = os.getenv("DTMF_API_TOKEN")

    # Limits
    MAX_STORES_TO_CALL: int = int(os.getenv("MAX_STORES_TO_CALL", "4"))
    MAX_ALTERNATIVES: int = int(os.getenv("MAX_ALTERNATIVES", "3"))

    # Test mode
    TEST_MODE: bool = os.getenv("TEST_MODE", "false").lower() in ("true", "1", "yes")
    TEST_PHONE: str = os.getenv("TEST_PHONE", "")

    @classmethod
    def validate(cls) -> None:
        return None
