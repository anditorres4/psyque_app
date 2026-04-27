"""Base AI Provider interface."""
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class AIResponse:
    """Standardized AI response."""

    content: str
    raw_response: dict
    model_used: str


class AIProvider(ABC):
    """Abstract base class for AI providers."""

    @abstractmethod
    def validate_key(self, api_key: str) -> tuple[bool, str]:
        """Validate the API key.
        
        Returns:
            Tuple of (is_valid, message)
        """
        pass

    @abstractmethod
    def generate(self, prompt: str, model: str | None = None) -> AIResponse:
        """Generate a response from the AI.
        
        Args:
            prompt: The prompt to send to the AI
            model: Optional model override
            
        Returns:
            AIResponse with content and metadata
        """
        pass

    @property
    @abstractmethod
    def available_models(self) -> list[str]:
        """List of available models for this provider."""
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the provider."""
        pass


def get_provider(provider: str, api_key: str) -> AIProvider:
    """Factory function to get an AI provider.
    
    Args:
        provider: Provider name ('anthropic', 'openai', 'gemini')
        api_key: API key for the provider
        
    Returns:
        AIProvider instance
        
    Raises:
        ValueError: If provider is not supported
    """
    from app.services.ai.providers.anthropic import AnthropicProvider
    from app.services.ai.providers.openai import OpenAIProvider
    from app.services.ai.providers.gemini import GeminiProvider

    providers = {
        "anthropic": AnthropicProvider,
        "openai": OpenAIProvider,
        "gemini": GeminiProvider,
    }

    provider_class = providers.get(provider.lower())
    if not provider_class:
        raise ValueError(f"Proveedor IA no soportado: {provider}")

    return provider_class(api_key)