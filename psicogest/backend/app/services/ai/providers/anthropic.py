"""Anthropic AI provider implementation."""
from typing import Any

import anthropic

from app.services.ai.providers.base import AIProvider, AIResponse


class AnthropicProvider(AIProvider):
    """Anthropic Claude provider."""

    MODELS = [
        "claude-opus-4-5-20250514",
        "claude-sonnet-4-20250514",
        "claude-haiku-4-5-20251001",
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307",
    ]

    def __init__(self, api_key: str):
        self._api_key = api_key
        self._client = anthropic.Anthropic(api_key=api_key)

    @property
    def provider_name(self) -> str:
        return "anthropic"

    @property
    def available_models(self) -> list[str]:
        return self.MODELS.copy()

    def validate_key(self, api_key: str) -> tuple[bool, str]:
        """Validate Anthropic API key with minimal token usage."""
        try:
            client = anthropic.Anthropic(api_key=api_key)
            client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1,
                messages=[{"role": "user", "content": "ok"}],
            )
            return True, "API key válida"
        except anthropic.AuthenticationError:
            return False, "API key inválida"
        except Exception as e:
            return False, f"Error al validar: {str(e)}"

    def generate(self, prompt: str, model: str | None = None) -> AIResponse:
        """Generate response using Anthropic Claude."""
        model = model or "claude-haiku-4-5-20251001"

        response = self._client.messages.create(
            model=model,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )

        content = ""
        if response.content:
            content = response.content[0].text

        return AIResponse(
            content=content,
            raw_response={"id": response.id, "usage": response.usage.model_dump()},
            model_used=model,
        )