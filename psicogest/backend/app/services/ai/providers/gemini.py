"""Google Gemini AI provider implementation."""
from typing import Any

import google.generativeai as genai

from app.services.ai.providers.base import AIProvider, AIResponse


class GeminiProvider(AIProvider):
    """Google Gemini provider."""

    MODELS = [
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
    ]

    def __init__(self, api_key: str):
        self._api_key = api_key
        genai.configure(api_key=api_key)

    @property
    def provider_name(self) -> str:
        return "gemini"

    @property
    def available_models(self) -> list[str]:
        return self.MODELS.copy()

    def validate_key(self, api_key: str) -> tuple[bool, str]:
        """Validate Google API key with minimal token usage."""
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            model.count_tokens("ok")
            return True, "API key válida"
        except Exception as e:
            error_msg = str(e).lower()
            if "api" in error_msg or "key" in error_msg:
                return False, "API key inválida"
            return False, f"Error al validar: {str(e)}"

    def generate(self, prompt: str, model: str | None = None) -> AIResponse:
        """Generate response using Gemini."""
        model = model or "gemini-1.5-flash"

        generation_model = genai.GenerativeModel(model)
        response = generation_model.generate_content(prompt)

        content = ""
        if response.parts:
            content = "\n".join([part.text for part in response.parts if hasattr(part, 'text')])

        return AIResponse(
            content=content,
            raw_response={
                "prompt_token_count": response.usage_metadata.prompt_token_count if response.usage_metadata else None,
                "candidates_token_count": response.usage_metadata.candidates_token_count if response.usage_metadata else None,
            },
            model_used=model,
        )