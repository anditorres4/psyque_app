"""OpenAI AI provider implementation."""
from typing import Any

import openai

from app.services.ai.providers.base import AIProvider, AIResponse


class OpenAIProvider(AIProvider):
    """OpenAI provider."""

    MODELS = [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo",
        "gpt-4",
        "gpt-3.5-turbo",
    ]

    def __init__(self, api_key: str):
        self._api_key = api_key
        self._client = openai.OpenAI(api_key=api_key)

    @property
    def provider_name(self) -> str:
        return "openai"

    @property
    def available_models(self) -> list[str]:
        return self.MODELS.copy()

    def validate_key(self, api_key: str) -> tuple[bool, str]:
        """Validate OpenAI API key."""
        try:
            client = openai.OpenAI(api_key=api_key)
            client.models.list()
            return True, "API key válida"
        except openai.AuthenticationError:
            return False, "API key inválida"
        except Exception as e:
            return False, f"Error al validar: {str(e)}"

    def generate(self, prompt: str, model: str | None = None) -> AIResponse:
        """Generate response using OpenAI."""
        model = model or "gpt-4o-mini"

        response = self._client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=4096,
        )

        content = response.choices[0].message.content or ""

        return AIResponse(
            content=content,
            raw_response={
                "id": response.id,
                "usage": response.usage.model_dump() if response.usage else {},
            },
            model_used=model,
        )