"""
THÉRÈSE v2 - Agent Runtime

Boucle agentique : system prompt → LLM → tool calls → continue.
Réutilise LLMService pour le streaming multi-provider.
"""

import json
import logging
from dataclasses import dataclass
from typing import Any, AsyncGenerator

from app.services.agents.config import AgentConfig
from app.services.agents.tools import AgentToolExecutor

logger = logging.getLogger(__name__)


@dataclass
class AgentEvent:
    """Événement émis par l'agent pendant l'exécution."""

    type: str  # "chunk", "tool_call", "tool_result", "done", "error"
    content: str = ""
    tool_name: str | None = None
    tool_args: dict[str, Any] | None = None
    tool_result: str | None = None


class AgentRuntime:
    """Runtime d'exécution pour un agent."""

    def __init__(
        self,
        config: AgentConfig,
        tool_executor: AgentToolExecutor,
        tools_schema: list[dict],
    ) -> None:
        self.config = config
        self.tool_executor = tool_executor
        self.tools_schema = tools_schema

    async def _execute_tool(self, name: str, args: dict[str, Any]) -> str:
        """Exécute un outil et retourne le résultat."""
        executor = self.tool_executor
        try:
            if name == "read_file":
                return await executor.read_file(**args)
            elif name == "write_file":
                return await executor.write_file(**args)
            elif name == "list_directory":
                return await executor.list_directory(**args)
            elif name == "search_codebase":
                return await executor.search_codebase(**args)
            elif name == "run_command":
                return await executor.run_command(**args)
            elif name == "git_status":
                return await executor.git_status()
            elif name == "git_diff":
                return await executor.git_diff()
            elif name == "clarify":
                return await executor.clarify(**args)
            elif name == "create_spec":
                return await executor.create_spec(**args)
            elif name == "explain_change":
                return await executor.explain_change(**args)
            else:
                return f"Outil inconnu : {name}"
        except PermissionError as e:
            return f"Permission refusée : {e}"
        except Exception as e:
            logger.error(f"Erreur outil {name}: {e}", exc_info=True)
            return f"Erreur : {e}"

    async def run(
        self,
        user_message: str,
        conversation_history: list[dict[str, str]] | None = None,
        extra_context: str = "",
    ) -> AsyncGenerator[AgentEvent, None]:
        """
        Exécute la boucle agentique en streaming.

        Yields AgentEvent pour chaque étape (chunks de texte, appels d'outils, résultats).
        """
        from app.services.llm import LLMService, Message as LLMMessage, get_llm_service

        # Obtenir le service LLM
        llm_service = get_llm_service()
        if not llm_service:
            yield AgentEvent(type="error", content="Aucun service LLM configuré. Vérifiez votre clé API.")
            return

        # Construire le system prompt
        system_prompt = self.config.system_prompt
        if extra_context:
            system_prompt += f"\n\n## Contexte supplémentaire\n{extra_context}"

        # Construire l'historique de messages
        messages: list[LLMMessage] = []
        if conversation_history:
            for msg in conversation_history:
                messages.append(LLMMessage(role=msg["role"], content=msg["content"]))
        messages.append(LLMMessage(role="user", content=user_message))

        # Boucle agentique (max_iterations pour éviter les boucles infinies)
        for iteration in range(self.config.max_iterations):
            logger.debug(f"Agent {self.config.id} - itération {iteration + 1}")

            # Préparer le contexte
            context = llm_service.prepare_context(messages, system_prompt=system_prompt)

            # Streaming de la réponse LLM
            full_content = ""
            tool_calls_raw: list[dict] = []

            try:
                # Utiliser stream_response_with_tools si des outils sont définis
                if self.tools_schema:
                    async for event in llm_service.stream_response_with_tools(
                        context, tools=self.tools_schema
                    ):
                        if hasattr(event, "type"):
                            if event.type == "text":
                                full_content += event.content
                                yield AgentEvent(type="chunk", content=event.content)
                            elif event.type == "tool_use":
                                tool_calls_raw.append({
                                    "id": getattr(event, "tool_use_id", ""),
                                    "name": event.tool_name,
                                    "arguments": event.tool_input if hasattr(event, "tool_input") else {},
                                })
                        elif isinstance(event, str):
                            full_content += event
                            yield AgentEvent(type="chunk", content=event)
                else:
                    async for chunk in llm_service.stream_response(context):
                        full_content += chunk
                        yield AgentEvent(type="chunk", content=chunk)

            except Exception as e:
                logger.error(f"Agent {self.config.id} erreur LLM: {e}", exc_info=True)
                yield AgentEvent(type="error", content=f"Erreur LLM : {e}")
                return

            # Pas d'appels d'outils → fin de la boucle
            if not tool_calls_raw:
                yield AgentEvent(type="done", content=full_content)
                return

            # Ajouter la réponse de l'assistant à l'historique
            messages.append(LLMMessage(role="assistant", content=full_content))

            # Exécuter les appels d'outils
            for tc in tool_calls_raw:
                tool_name = tc.get("name", "")
                tool_args = tc.get("arguments", {})
                if isinstance(tool_args, str):
                    try:
                        tool_args = json.loads(tool_args)
                    except json.JSONDecodeError:
                        tool_args = {}

                yield AgentEvent(
                    type="tool_call",
                    tool_name=tool_name,
                    tool_args=tool_args,
                )

                result = await self._execute_tool(tool_name, tool_args)

                yield AgentEvent(
                    type="tool_result",
                    tool_name=tool_name,
                    tool_result=result,
                )

                # Ajouter le résultat à l'historique pour la prochaine itération
                messages.append(LLMMessage(
                    role="user",
                    content=f"[Résultat de {tool_name}]\n{result}",
                ))

        # Max iterations atteint
        yield AgentEvent(
            type="error",
            content=f"Nombre maximum d'itérations atteint ({self.config.max_iterations})",
        )
