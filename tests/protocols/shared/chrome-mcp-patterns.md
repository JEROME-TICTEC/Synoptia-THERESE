# Patterns Chrome MCP - Anti-flaky

> Regles et patterns pour des tests browser fiables via Chrome MCP.

## 6 regles fondamentales

1. **Toujours data-testid** : ne jamais utiliser de selecteurs CSS (.class, #id) qui changent a chaque refactor. Si pas de data-testid, utiliser aria-label ou role comme fallback.

2. **Toujours wait_for avant click** : l'element doit etre visible ET interactif. Ne jamais cliquer sur un element qui vient d'apparaitre sans attente.

3. **Apres une action async, wait_for le resultat** : pas de `sleep(5)`. Attendre que `[data-testid=chat-message-item]` apparaisse, ou que `textContent.length > 0`.

4. **Apres une animation, wait 500ms** : les transitions Framer Motion durent 300-500ms. Un clic pendant l'animation cause des etats inconsistants.

5. **Pour le SSE streaming, wait_for contenu** : `textContent.length > 10` pas `> 0`. Un element peut exister dans le DOM avec un contenu vide pendant le setup du stream.

6. **Screenshot apres chaque etape critique** : pour debug et preuve visuelle.

## Patterns par type de composant

### Chat (envoi + streaming)

```
1. javascript_tool : set input value via React native setter
   const input = document.querySelector('[data-testid="chat-message-input"]');
   const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
   setter.call(input, 'Mon message');
   input.dispatchEvent(new Event('input', { bubbles: true }));

2. click [data-testid="chat-send-btn"]

3. wait_for [data-testid="chat-message-item"] (timeout 30s pour LLM)

4. javascript_tool : verifier le contenu
   document.querySelectorAll('[data-testid="chat-message-item"]').length >= 2
```

### Formulaires React (onboarding, settings, contacts)

```
1. wait_for le formulaire visible
2. fill chaque champ UN PAR UN (pas fill_form)
3. wait 100ms entre chaque fill (React state batching)
4. click bouton submit
5. wait_for resultat (toast, redirect, element cree)
```

### Modales

```
1. click bouton ouverture
2. wait_for [data-testid="xxx-modal"] visible
3. Actions dans la modale
4. click fermeture [data-testid="xxx-close-btn"]
5. wait_for ABSENCE du modal dans le DOM
```

### Navigation entre pages (Server)

```
1. click [data-testid="nav-link-xxx"]
2. wait_for changement d'URL (window.location.pathname)
3. wait_for element specifique de la page cible
```

### Panels App (via URL directe)

```
1. tabs_create_mcp (nouvel onglet)
2. navigate http://localhost:1420/?panel=tasks
3. wait 2s (chargement panel + API)
4. javascript_tool : verifier [data-testid="tasks-panel"]
```

### RBAC (Server)

```
# Verifier qu'un element est ABSENT
1. javascript_tool :
   document.querySelector('[data-testid="nav-link-admin"]') === null
   // doit retourner true pour un agent

# Verifier qu'une page redirige
2. navigate /admin
3. wait 2s
4. javascript_tool : window.location.pathname === '/chat'
   // redirect vers chat si pas admin
```

### XSS

```
1. Set input value : '<script>alert(1)</script>'
2. click send
3. wait 3s
4. javascript_tool :
   - Aucun <script> injecte : document.querySelectorAll('script:not([src])').filter(...)
   - Pas d'alerte : on est toujours la (pas de dialog bloquant)
   - Texte echappe visible en clair dans le DOM
```

## Timeouts recommandes

| Action | Timeout |
|--------|---------|
| Navigation page | 5s |
| Apparition element | 5s |
| Reponse LLM (chat) | 30s |
| Deliberation Board (5 conseillers) | 60s |
| Animation Framer Motion | 500ms |
| Toast notification | capture dans les 3s |
| Formulaire save + API | 5s |

## Gestion des faux positifs connus

| Erreur | Contexte | Action |
|--------|---------|--------|
| `useFileDrop.ts transformCallback` | App en mode browser (pas Tauri) | IGNORER |
| `no such column: invoices.payment_terms` | Migration SQLite manquante | NOTER comme bug P1 |
| `Failed to preload embedding model` | Modele lourd au demarrage | IGNORER (lazy load) |
