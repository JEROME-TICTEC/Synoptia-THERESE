# Protocoles de Tests Exhaustifs - THERESE

> Tests browser via Chrome MCP, organisés par persona et user stories.
> Conçu le 28 mars 2026, panel 4 experts (QA Senior, Avocat du diable, UX, Dev Frontend).

## Architecture

```
tests/protocols/
  app/                               # THERESE App (Desktop Tauri)
    personas/
      A1-sophie-freelance.md         # Graphiste freelance, non-tech (48 etapes, ~180 tests)
      A2-marc-consultant.md          # Consultant RH, Excel (42 etapes, ~160 tests)
      A3-lea-power-user.md           # Coach business, power user (55 etapes, ~220 tests)
    modules/                         # Tests par module (a venir)
    catastrophes/                    # Scenarios catastrophe App

  server/                            # THERESE Server (Web multi-tenant)
    personas/
      S1-agent-municipal.md          # Agent role=agent (35 etapes, ~130 tests)
      S2-chef-service.md             # Manager role=manager (38 etapes, ~140 tests)
      S3-dsi-admin.md                # DSI role=admin (42 etapes, ~170 tests)
    modules/                         # Tests par module (a venir)
    catastrophes/                    # Scenarios catastrophe Server

  shared/
    catastrophes.md                  # 10 scenarios catastrophe transversaux
    chrome-mcp-patterns.md           # Patterns anti-flaky Chrome MCP
    data-testid-inventory.md         # Inventaire data-testid (a venir)
```

## Personas

| Persona | Produit | Etapes | Tests | Duree Chrome MCP |
|---------|---------|--------|-------|-----------------|
| A1 Sophie (freelance) | App | 48 | ~180 | 2h30-3h |
| A2 Marc (consultant) | App | 42 | ~160 | 2h-2h30 |
| A3 Lea (power user) | App | 55 | ~220 | 3h-3h30 |
| S1 Agent Municipal | Server | 35 | ~130 | 1h30-2h |
| S2 Chef de Service | Server | 38 | ~140 | 1h30-2h |
| S3 DSI Admin | Server | 42 | ~170 | 2h-2h30 |
| **TOTAL** | | **260** | **~1000** | **13-16h** |

## Comment lancer

### App (THERESE Desktop)
```bash
# 1. Lancer backend + frontend
cd ~/Desktop/Dev\ Synoptia/Synoptia-THERESE
make dev-backend &
make dev-frontend &

# 2. Ouvrir Chrome avec extension Claude-in-Chrome

# 3. Lancer une persona
/test-therese  # pour la batterie rapide
# OU suivre le protocole persona manuellement
```

### Server (THERESE Server)
```bash
# 1. Tunnel SSH vers le VPS
ssh -f -N -L 8880:127.0.0.1:80 ubuntu@51.178.16.63

# 2. Ouvrir Chrome

# 3. Lancer une persona
/test-therese-server --url http://localhost:8880
```

## Priorites

- **P0** : bloquant release - si FAIL, on ne publie pas
- **P1** : important - a corriger avant la prochaine release
- **P2** : nice to have - backlog

## Ordre d'execution recommande

1. S1 Agent (Server) - le plus court, valide le socle auth
2. A1 Sophie (App) - valide l'onboarding et le parcours de base
3. S3 DSI Admin (Server) - valide admin + RBAC
4. A3 Lea (App) - power user, couvre les edge cases
5. Catastrophes - les 10 scenarios critiques
6. A2 Marc + S2 Chef de Service - couverture complete
