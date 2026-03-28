"""Circuit breaker pour les providers LLM.

Pattern closed/open/half-open :
- closed : tout fonctionne normalement
- open : le provider est considéré down, on bascule sur le fallback
- half-open : on teste si le provider est revenu (toutes les 5 min)

Config : 2 échecs consécutifs OU timeout 15s -> open

US-006 : Circuit breaker LLM avec bascule automatique
"""

import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


class CircuitState(str, Enum):
    """États du circuit breaker."""

    CLOSED = "closed"       # Tout fonctionne normalement
    OPEN = "open"           # Provider considéré down
    HALF_OPEN = "half-open"  # Test en cours pour voir si le provider est revenu


# --- Configuration -----------------------------------------------------------

FAILURE_THRESHOLD = 2          # Échecs consécutifs avant ouverture
RECOVERY_TIMEOUT = 300.0       # 5 minutes avant tentative de récupération
REQUEST_TIMEOUT = 15.0         # Timeout considéré comme échec


@dataclass
class ProviderCircuit:
    """État du circuit breaker pour un provider donné."""

    provider: str
    state: CircuitState = CircuitState.CLOSED
    consecutive_failures: int = 0
    last_failure_time: float = 0.0
    last_success_time: float = 0.0
    last_error: str | None = None
    total_failures: int = 0
    total_successes: int = 0
    last_state_change: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        """Sérialise l'état du circuit pour l'API."""
        now = time.time()
        return {
            "provider": self.provider,
            "state": self.state.value,
            "consecutive_failures": self.consecutive_failures,
            "last_failure_time": self.last_failure_time if self.last_failure_time else None,
            "last_success_time": self.last_success_time if self.last_success_time else None,
            "last_error": self.last_error,
            "total_failures": self.total_failures,
            "total_successes": self.total_successes,
            "seconds_since_last_failure": (
                round(now - self.last_failure_time, 1)
                if self.last_failure_time
                else None
            ),
            "seconds_since_last_success": (
                round(now - self.last_success_time, 1)
                if self.last_success_time
                else None
            ),
            "seconds_in_current_state": round(now - self.last_state_change, 1),
        }


class CircuitBreakerManager:
    """Gestionnaire de circuit breakers pour tous les providers LLM.

    Singleton : un seul gestionnaire pour toute l'application.
    Thread-safe via le GIL Python (suffisant pour asyncio single-thread).
    """

    _instance: "CircuitBreakerManager | None" = None
    _circuits: dict[str, ProviderCircuit]

    def __new__(cls) -> "CircuitBreakerManager":
        if cls._instance is None:
            instance = super().__new__(cls)
            instance._circuits = {}
            cls._instance = instance
        return cls._instance

    def _get_circuit(self, provider: str) -> ProviderCircuit:
        """Récupère ou crée le circuit pour un provider."""
        provider = provider.lower()
        if provider not in self._circuits:
            self._circuits[provider] = ProviderCircuit(provider=provider)
        return self._circuits[provider]

    def is_available(self, provider: str) -> bool:
        """Vérifie si un provider est disponible (circuit fermé ou half-open).

        Returns:
            True si le provider peut recevoir des requêtes.
        """
        circuit = self._get_circuit(provider)

        if circuit.state == CircuitState.CLOSED:
            return True

        if circuit.state == CircuitState.OPEN:
            # Vérifier si le timeout de récupération est écoulé
            elapsed = time.time() - circuit.last_failure_time
            if elapsed >= RECOVERY_TIMEOUT:
                # Passer en half-open pour tester
                self._transition(circuit, CircuitState.HALF_OPEN)
                logger.info(
                    "Circuit breaker %s: OPEN -> HALF_OPEN "
                    "(après %.0fs, tentative de récupération)",
                    provider, elapsed,
                )
                return True
            return False

        # HALF_OPEN : on laisse passer UNE requête de test
        return True

    def record_success(self, provider: str) -> None:
        """Enregistre un succès pour un provider."""
        circuit = self._get_circuit(provider)
        circuit.consecutive_failures = 0
        circuit.last_success_time = time.time()
        circuit.total_successes += 1

        if circuit.state != CircuitState.CLOSED:
            old_state = circuit.state
            self._transition(circuit, CircuitState.CLOSED)
            logger.info(
                "Circuit breaker %s: %s -> CLOSED (provider rétabli)",
                provider, old_state.value,
            )

    def record_failure(self, provider: str, error: str) -> None:
        """Enregistre un échec pour un provider.

        Après FAILURE_THRESHOLD échecs consécutifs, ouvre le circuit.
        """
        circuit = self._get_circuit(provider)
        circuit.consecutive_failures += 1
        circuit.last_failure_time = time.time()
        circuit.last_error = error
        circuit.total_failures += 1

        # En half-open, un seul échec suffit pour repasser en open
        if circuit.state == CircuitState.HALF_OPEN:
            self._transition(circuit, CircuitState.OPEN)
            logger.warning(
                "Circuit breaker %s: HALF_OPEN -> OPEN (test échoué: %s)",
                provider, error,
            )
            return

        # En closed, vérifier le seuil
        if (
            circuit.state == CircuitState.CLOSED
            and circuit.consecutive_failures >= FAILURE_THRESHOLD
        ):
            self._transition(circuit, CircuitState.OPEN)
            logger.warning(
                "Circuit breaker %s: CLOSED -> OPEN "
                "(%d échecs consécutifs, dernière erreur: %s)",
                provider, circuit.consecutive_failures, error,
            )

    def get_state(self, provider: str) -> CircuitState:
        """Retourne l'état actuel du circuit pour un provider."""
        return self._get_circuit(provider).state

    def get_all_statuses(self) -> dict[str, dict[str, Any]]:
        """Retourne l'état de tous les circuits connus."""
        return {
            name: circuit.to_dict()
            for name, circuit in sorted(self._circuits.items())
        }

    def get_status(self, provider: str) -> dict[str, Any]:
        """Retourne l'état d'un circuit spécifique."""
        return self._get_circuit(provider).to_dict()

    def reset(self, provider: str | None = None) -> None:
        """Reset un circuit (ou tous si provider=None).

        Utile pour les tests ou le debug.
        """
        if provider:
            provider = provider.lower()
            if provider in self._circuits:
                self._circuits[provider] = ProviderCircuit(provider=provider)
                logger.info("Circuit breaker %s: reset manuel", provider)
        else:
            self._circuits.clear()
            logger.info("Circuit breaker: reset global de tous les circuits")

    def get_degraded_message(self) -> str | None:
        """Retourne un message de mode dégradé si au moins un provider est open.

        Utilisé par le frontend pour afficher un bandeau d'alerte.
        """
        open_providers = [
            name
            for name, circuit in self._circuits.items()
            if circuit.state == CircuitState.OPEN
        ]
        if not open_providers:
            return None

        providers_str = ", ".join(open_providers)
        return (
            "Mode dégradé - "
            + providers_str
            + " indisponible(s), modèle de secours actif"
        )

    @staticmethod
    def _transition(circuit: ProviderCircuit, new_state: CircuitState) -> None:
        """Effectue une transition d'état."""
        circuit.state = new_state
        circuit.last_state_change = time.time()


# --- Fonctions utilitaires (accès singleton) ---------------------------------


def get_circuit_breaker() -> CircuitBreakerManager:
    """Récupère le singleton du circuit breaker manager."""
    return CircuitBreakerManager()
