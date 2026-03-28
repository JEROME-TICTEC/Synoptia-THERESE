# Protocole de test - S1 : Agent Municipal

> Persona : agent municipal dans une mairie de 300-500 agents
> Role : `agent` (RBAC)
> Cible : THERESE Server (FastAPI + React, multi-tenant)
> Version minimale : v0.4.1
> Derniere MAJ : 27 mars 2026

---

## Informations generales

| Cle | Valeur |
|-----|--------|
| Persona | S1 - Agent Municipal |
| Role RBAC | `agent` |
| URL | `http://localhost:8880` |
| Credentials | `agent@therese.local` / `agent` |
| Organisation | Mairie de Manosque (org test) |
| Navigateur | Chrome (Chrome MCP) |
| Screenshots | `/tmp/therese-server-tests/S1-*.png` |
| Duree estimee | 25-35 minutes |
| Pre-requis | Compte agent cree, serveur demarre, au moins 1 template public |

## Modules couverts

- Auth / Login
- Charte IA (bloquante)
- Chat (conversations, streaming, templates)
- Taches
- Contacts CRM
- Board de decision (5 conseillers)
- Skills (19 competences)
- RBAC (interdiction admin)
- Recherche globale
- Deconnexion

## Convention selecteurs

Chaque etape fournit un selecteur `data-testid` (prioritaire) ET un fallback naturel pour les environnements ou les testid ne sont pas encore deployes.

**Syntaxe fallback** : `[aria-label="X"]`, `button:has-text("X")`, `role=X`, ou selecteur CSS standard.

---

## Preparation

```bash
# 1. Creer le dossier screenshots
mkdir -p /tmp/therese-server-tests

# 2. Verifier que le serveur repond
curl -s http://localhost:8880/api/health | jq .

# 3. Verifier que le compte agent existe (sinon le creer via admin)
curl -s -X POST http://localhost:8880/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"agent@therese.local","password":"agent"}' | jq .status

# 4. Si 401 : creer le compte via l'admin
curl -s -X POST http://localhost:8880/api/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"agent@therese.local","password":"agent","name":"Jean Dupont","role":"agent"}'
```

---

## Etapes de test

---

### Etape 1 : Naviguer vers /login

**Priorite** : P0

**Actions Chrome MCP** :
1. `navigate` → `http://localhost:8880/login`
2. `wait_for` → page chargee, formulaire visible
3. Verifier presence du formulaire de connexion

**Selecteur principal** : `[data-testid="login-form"]`
**Fallback** : `form[action*="login"]` ou `form:has(input[type="email"])`

**Resultat attendu** : La page /login s'affiche avec un formulaire contenant email, mot de passe, bouton de connexion. Aucune NavBar visible (pas encore authentifie).
**Etats testes** : empty
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-01_login-page.png`

---

### Etape 2 : Soumettre formulaire vide

**Priorite** : P1

**Actions Chrome MCP** :
1. `click` → `[data-testid="login-submit-btn"]` | fallback : `button[type="submit"]`
2. `wait_for` → validation navigateur (required)
3. Verifier que la page ne change pas (pas de requete envoyee)

**Resultat attendu** : Le navigateur affiche une bulle de validation HTML native sur le champ email ("Veuillez remplir ce champ" ou equivalent). Aucune requete reseau envoyee.
**Etats testes** : empty | error
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-02_form-vide.png`

---

### Etape 3 : Mauvais mot de passe

**Priorite** : P0

**Actions Chrome MCP** :
1. `fill` → `[data-testid="login-email-input"]` | fallback : `input[type="email"]` → `agent@therese.local`
2. `fill` → `[data-testid="login-password-input"]` | fallback : `input[type="password"]` → `mauvais_mdp`
3. `click` → `[data-testid="login-submit-btn"]` | fallback : `button[type="submit"]`
4. `wait_for` → message d'erreur visible

**Resultat attendu** : Un message d'erreur rouge s'affiche ("Identifiants incorrects" ou "Email ou mot de passe invalide"). Le formulaire reste sur /login. Pas de token JWT stocke.
**Etats testes** : error
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-03_mauvais-mdp.png`

**Verification supplementaire** : Ouvrir DevTools > Application > Local Storage → aucune cle `token` ou `access_token` presente.

---

### Etape 4 : Login correct

**Priorite** : P0

**Actions Chrome MCP** :
1. `fill` → `[data-testid="login-email-input"]` | fallback : `input[type="email"]` → `agent@therese.local`
2. `fill` → `[data-testid="login-password-input"]` | fallback : `input[type="password"]` → `agent`
3. `click` → `[data-testid="login-submit-btn"]` | fallback : `button[type="submit"]`
4. `wait_for` → redirection vers /chat OU affichage de la charte IA

**Resultat attendu** : Connexion reussie. Si c'est la premiere connexion, la CharterModal s'affiche par-dessus /chat. Sinon, /chat s'affiche directement. Un JWT est stocke dans localStorage.
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-04_login-correct.png`

**Verification supplementaire** : DevTools > Application > Local Storage → cle `token` ou `access_token` presente avec une valeur JWT (format `eyJ...`).

---

### Etape 5 : Voir CharterModal (charte IA)

**Priorite** : P0

**Actions Chrome MCP** :
1. `wait_for` → `[data-testid="charter-modal"]` | fallback : `[role="dialog"]` ou `.modal:has-text("charte")`
2. Verifier que le texte est scrollable (contenu long)
3. Verifier que le bouton "Accepter" est present
4. Verifier que la navigation derriere est bloquee (modale bloquante)

**Selecteur modal** : `[data-testid="charter-modal"]`
**Selecteur bouton** : `[data-testid="charter-accept-btn"]`
**Fallback modal** : `[role="dialog"]`, `.charter-modal`
**Fallback bouton** : `button:has-text("Accepter")`, `button:has-text("J'accepte")`

**Resultat attendu** : La modale de charte IA s'affiche en plein ecran ou en overlay. Le texte explique les conditions d'utilisation de l'IA. Le bouton "Accepter" est visible en bas. Cliquer en dehors de la modale ne la ferme PAS.
**Etats testes** : empty (premiere connexion)
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-05_charte-modal.png`

**Note** : Si la charte a deja ete acceptee lors d'un test precedent, reinitialiser l'etat via API :
```bash
curl -X DELETE http://localhost:8880/api/users/me/charter \
  -H "Authorization: Bearer $TOKEN"
```

---

### Etape 6 : Accepter la charte

**Priorite** : P0

**Actions Chrome MCP** :
1. `click` → `[data-testid="charter-accept-btn"]` | fallback : `button:has-text("Accepter")`
2. `wait_for` → modale disparait, /chat visible
3. Verifier que la NavBar apparait

**Resultat attendu** : La modale se ferme. La page /chat est visible avec la NavBar en haut ou a gauche. L'API a enregistre l'acceptation (charter_accepted_at != null).
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-06_charte-acceptee.png`

**Verification API** :
```bash
curl -s http://localhost:8880/api/users/me \
  -H "Authorization: Bearer $TOKEN" | jq .charter_accepted_at
# Doit retourner une date ISO, pas null
```

---

### Etape 7 : Verifier NavBar (RBAC agent)

**Priorite** : P0

**Actions Chrome MCP** :
1. Verifier presence : `[data-testid="nav-link-chat"]` | fallback : `a[href="/chat"]`, `nav a:has-text("Chat")`
2. Verifier presence : `[data-testid="nav-link-tasks"]` | fallback : `a[href="/tasks"]`
3. Verifier presence : `[data-testid="nav-link-skills"]` | fallback : `a[href="/skills"]`
4. Verifier presence : `[data-testid="nav-link-crm"]` | fallback : `a[href="/crm"]`
5. Verifier presence : `[data-testid="nav-link-board"]` | fallback : `a[href="/board"]`
6. Verifier ABSENCE : `[data-testid="nav-link-admin"]` | fallback : `a[href="/admin"]`

**Resultat attendu** : Les 5 liens de navigation (Chat, Taches, Skills, Contacts, Board) sont visibles. Le lien "Admin" ou "Administration" est ABSENT. C'est le test RBAC fondamental cote frontend.
**Etats testes** : rbac
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-07_navbar-rbac.png`

**CRITIQUE** : Si le lien Admin est visible, c'est un defaut RBAC. Stopper le protocole et remonter le bug immediatement.

---

### Etape 8 : Chat vide - message de bienvenue

**Priorite** : P1

**Actions Chrome MCP** :
1. `navigate` → `http://localhost:8880/chat` (si pas deja dessus)
2. `wait_for` → `[data-testid="message-list"]` | fallback : `.message-list`, `[role="log"]`
3. Verifier qu'un message de bienvenue ou un etat vide est affiche

**Resultat attendu** : La page chat affiche soit un message de bienvenue ("Bonjour, comment puis-je vous aider ?") soit un etat vide avec une indication ("Commencez une conversation"). Pas d'erreur, pas de spinner infini.
**Etats testes** : empty
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-08_chat-vide.png`

---

### Etape 9 : Nouvelle conversation

**Priorite** : P0

**Actions Chrome MCP** :
1. `click` → `[data-testid="new-conversation-btn"]` | fallback : `button:has-text("Nouvelle")`, `button[aria-label="Nouvelle conversation"]`
2. `wait_for` → conversation creee, input chat actif

**Resultat attendu** : Une nouvelle conversation apparait dans la liste laterale (si sidebar visible) ou la zone de chat se reinitialise. Le champ de saisie est actif (focus).
**Etats testes** : empty
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-09_nouvelle-conv.png`

---

### Etape 10 : Verifier placeholder du champ message

**Priorite** : P2

**Actions Chrome MCP** :
1. `wait_for` → `[data-testid="chat-message-input"]` | fallback : `textarea`, `input[placeholder]`
2. Verifier l'attribut `placeholder` du champ (non vide)
3. Verifier que le champ est editable

**Resultat attendu** : Le champ de saisie affiche un placeholder explicite (ex: "Ecrivez votre message...", "Posez votre question..."). Le champ accepte la saisie.
**Etats testes** : empty
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-10_placeholder.png`

---

### Etape 11 : Envoyer un message - streaming IA

**Priorite** : P0

**Actions Chrome MCP** :
1. `fill` → `[data-testid="chat-message-input"]` | fallback : `textarea` → `Quels sont les horaires d'ouverture de la mairie ?`
2. `click` → `[data-testid="chat-send-btn"]` | fallback : `button[aria-label="Envoyer"]`, `button:has(svg)` (icone send)
3. `wait_for` → reponse IA en streaming (texte qui apparait progressivement)
4. Attendre fin du streaming (bouton send redevient actif)

**Resultat attendu** : Le message utilisateur apparait dans la liste. Une reponse IA commence a s'afficher en streaming (caractere par caractere ou chunk par chunk). Le streaming se termine proprement. Pas de message d'erreur.
**Etats testes** : filled | loading
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-11_streaming.png`

**Verification reseau** : DevTools > Network → requete SSE vers `/api/chat/stream` ou `/api/chat/deliberate` avec Content-Type `text/event-stream`.

---

### Etape 12 : Verifier messages (user + assistant)

**Priorite** : P0

**Actions Chrome MCP** :
1. `wait_for` → au moins 2 `[data-testid="message-item"]` | fallback : `.message-item`, `[role="log"] > div`
2. Verifier que le premier message a le role "user" (bulle droite ou label "Vous")
3. Verifier que le second message a le role "assistant" (bulle gauche ou label "Therese")

**Resultat attendu** : La conversation contient exactement 2 messages : un message utilisateur et une reponse assistant. Les deux sont visuellement distincts (couleur, alignement, ou label).
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-12_messages.png`

---

### Etape 13 : Templates - ouvrir le selecteur

**Priorite** : P1

**Actions Chrome MCP** :
1. Chercher un bouton ou icone "Templates" / "Modeles" pres du champ de saisie
2. `click` → bouton templates | fallback : `button:has-text("Template")`, `button[aria-label="Templates"]`, `.template-selector`
3. `wait_for` → liste de templates visible

**Resultat attendu** : Un panneau, dropdown ou modale s'ouvre avec la liste des templates disponibles. Au moins 10 templates sont affiches (secteur public : courrier, note de service, compte-rendu, etc.).
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-13_templates-liste.png`

---

### Etape 14 : Selectionner un template

**Priorite** : P1

**Actions Chrome MCP** :
1. `click` → premier template de la liste
2. `wait_for` → champ de saisie pre-rempli avec le prompt du template

**Resultat attendu** : Le champ de saisie se remplit avec le contenu du template selectionne. Le texte est editable (l'agent peut le modifier avant envoi). Le selecteur de templates se ferme.
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-14_template-select.png`

---

### Etape 15 : Naviguer vers /tasks

**Priorite** : P0

**Actions Chrome MCP** :
1. `click` → `[data-testid="nav-link-tasks"]` | fallback : `a[href="/tasks"]`, `nav a:has-text("Taches")`
2. `wait_for` → `[data-testid="tasks-page"]` | fallback : page /tasks chargee

**Resultat attendu** : La page Taches s'affiche. La liste des taches est visible (vide ou avec des taches existantes). Un bouton "Creer" ou "+" est present.
**Etats testes** : empty
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-15_tasks-page.png`

---

### Etape 16 : Creer une tache

**Priorite** : P0

**Actions Chrome MCP** :
1. `click` → `[data-testid="tasks-create-btn"]` | fallback : `button:has-text("Creer")`, `button:has-text("Nouvelle tache")`, `button[aria-label="Ajouter"]`
2. `wait_for` → formulaire de creation visible
3. `fill` → champ titre → `Preparer dossier urbanisme`
4. `fill` → champ description (si present) → `Rassembler les pieces pour le permis de construire n.2026-042`

**Resultat attendu** : Le formulaire de creation de tache s'ouvre (modale ou page). Les champs titre et description sont editables.
**Etats testes** : empty | filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-16_task-create.png`

---

### Etape 17 : Sauvegarder la tache

**Priorite** : P0

**Actions Chrome MCP** :
1. `click` → bouton "Sauvegarder" / "Creer" / "Valider" | fallback : `button[type="submit"]`, `button:has-text("Sauvegarder")`
2. `wait_for` → tache apparait dans la liste `[data-testid="tasks-list"]` | fallback : `.tasks-list`
3. Verifier que le titre "Preparer dossier urbanisme" est visible dans la liste

**Resultat attendu** : La tache est creee et apparait dans la liste. Le titre est correct. Un statut par defaut est attribue (ex: "A faire", "En cours").
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-17_task-saved.png`

**Verification API** :
```bash
curl -s http://localhost:8880/api/tasks \
  -H "Authorization: Bearer $TOKEN" | jq '.[0].title'
# Doit contenir "Preparer dossier urbanisme"
```

---

### Etape 18 : Cocher la tache comme terminee

**Priorite** : P1

**Actions Chrome MCP** :
1. `click` → checkbox ou bouton "Terminer" sur le `[data-testid="task-item"]` | fallback : `input[type="checkbox"]`, `.task-item .checkbox`
2. `wait_for` → la tache change visuellement (barree, grisee, badge "Terminee")

**Resultat attendu** : La tache est marquee comme terminee. Un indicateur visuel confirme le changement (texte barre, couleur differente, badge). La tache reste visible dans la liste (pas de suppression automatique).
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-18_task-done.png`

---

### Etape 19 : Naviguer vers /crm (contacts)

**Priorite** : P0

**Actions Chrome MCP** :
1. `click` → `[data-testid="nav-link-crm"]` | fallback : `a[href="/crm"]`, `nav a:has-text("Contacts")`
2. `wait_for` → `[data-testid="crm-page"]` | fallback : page /crm chargee

**Resultat attendu** : La page Contacts/CRM s'affiche. La liste des contacts est visible (vide ou avec des contacts existants). Un bouton "Creer" ou "Ajouter" est present.
**Etats testes** : empty
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-19_crm-page.png`

---

### Etape 20 : Creer un contact

**Priorite** : P0

**Actions Chrome MCP** :
1. `click` → `[data-testid="crm-create-contact-btn"]` | fallback : `button:has-text("Ajouter")`, `button:has-text("Nouveau contact")`
2. `wait_for` → formulaire de creation visible
3. `fill` → champ nom → `Marie Lambert`
4. `fill` → champ fonction/titre (si present) → `DGS`
5. `fill` → champ email (si present) → `m.lambert@mairie-manosque.fr`

**Resultat attendu** : Le formulaire de creation de contact s'ouvre. Les champs nom, fonction et email sont editables.
**Etats testes** : empty | filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-20_contact-create.png`

---

### Etape 21 : Sauvegarder le contact

**Priorite** : P0

**Actions Chrome MCP** :
1. `click` → bouton "Sauvegarder" / "Creer" | fallback : `button[type="submit"]`
2. `wait_for` → contact apparait dans `[data-testid="crm-contact-list"]` | fallback : `.contact-list`
3. Verifier que "Marie Lambert" est visible

**Resultat attendu** : Le contact est cree et apparait dans la liste. Le nom et la fonction sont affiches correctement.
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-21_contact-saved.png`

**Verification API** :
```bash
curl -s http://localhost:8880/api/crm/contacts \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | select(.name=="Marie Lambert")'
```

---

### Etape 22 : Rechercher un contact

**Priorite** : P1

**Actions Chrome MCP** :
1. Chercher un champ de recherche sur la page CRM
2. `fill` → champ recherche | fallback : `input[placeholder*="Rechercher"]`, `input[type="search"]` → `Lambert`
3. `wait_for` → filtrage de la liste (debounce ~300ms)
4. Verifier que seul "Marie Lambert" apparait (ou les contacts contenant "Lambert")

**Resultat attendu** : La liste se filtre en temps reel. Seuls les contacts contenant "Lambert" sont affiches. Les autres contacts sont masques (pas supprimes).
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-22_contact-search.png`

---

### Etape 23 : Naviguer vers /board

**Priorite** : P0

**Actions Chrome MCP** :
1. `click` → `[data-testid="nav-link-board"]` | fallback : `a[href="/board"]`, `nav a:has-text("Board")`
2. `wait_for` → `[data-testid="board-page"]` | fallback : page /board chargee
3. Verifier que le panneau Board est visible avec un champ de saisie

**Resultat attendu** : La page Board s'affiche. Un champ de saisie pour poser une question est visible. Les 5 conseillers (ou leur representation) sont affiches.
**Etats testes** : empty
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-23_board-page.png`

---

### Etape 24 : Poser une question au Board

**Priorite** : P0

**Actions Chrome MCP** :
1. `fill` → champ de saisie Board `[data-testid="board-panel"] textarea` | fallback : `textarea`, `input[placeholder*="question"]` → `Comment ameliorer l'accueil du public ?`
2. `click` → `[data-testid="board-submit-btn"]` | fallback : `button:has-text("Deliberer")`, `button:has-text("Soumettre")`
3. `wait_for` → debut du streaming de la deliberation

**Resultat attendu** : La question est envoyee. Le Board lance la deliberation avec les 5 conseillers. Le streaming commence (chaque conseiller repond tour a tour ou en parallele).
**Etats testes** : filled | loading
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-24_board-question.png`

---

### Etape 25 : Voir resultat deliberation

**Priorite** : P0

**Actions Chrome MCP** :
1. `wait_for` → `[data-testid="board-result"]` | fallback : `.board-result`, `.deliberation-result`
2. Attendre fin du streaming (tous les conseillers ont repondu)
3. Verifier que le resultat contient des contributions de plusieurs conseillers
4. Verifier la presence d'une synthese ou recommandation finale

**Resultat attendu** : Le resultat de la deliberation est affiche. Chaque conseiller a apporte sa contribution (identifiable par nom, emoji ou couleur). Une synthese ou recommandation finale est visible. Pas de message d'erreur.
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-25_board-result.png`

**Timeout** : La deliberation peut prendre 30-60 secondes (5 appels LLM). Configurer un timeout de 90s.

---

### Etape 26 : Naviguer vers /skills

**Priorite** : P0

**Actions Chrome MCP** :
1. `click` → `[data-testid="nav-link-skills"]` | fallback : `a[href="/skills"]`, `nav a:has-text("Skills")`
2. `wait_for` → `[data-testid="skills-page"]` | fallback : page /skills chargee

**Resultat attendu** : La page Skills s'affiche avec la liste des competences disponibles.
**Etats testes** : empty
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-26_skills-page.png`

---

### Etape 27 : Voir les 19 skills (categories)

**Priorite** : P1

**Actions Chrome MCP** :
1. `wait_for` → `[data-testid="skills-list"]` | fallback : `.skills-list`, `.skills-grid`
2. Compter le nombre de `[data-testid="skill-item"]` | fallback : `.skill-item`, `.skill-card`
3. Verifier qu'il y a au moins 15 skills affiches (19 attendus)
4. Verifier que les categories sont visibles (ex: Office, Analyse, Generation, etc.)

**Resultat attendu** : La liste affiche 19 skills organises par categories. Chaque skill a un nom, une description et une icone/emoji. Les categories regroupent logiquement les skills.
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-27_skills-list.png`

**Verification API** :
```bash
curl -s http://localhost:8880/api/skills/list \
  -H "Authorization: Bearer $TOKEN" | jq 'length'
# Doit retourner 19 (ou plus)
```

---

### Etape 28 : Cliquer sur un skill - detail

**Priorite** : P1

**Actions Chrome MCP** :
1. `click` → premier `[data-testid="skill-item"]` | fallback : `.skill-item:first-child`, `.skill-card:first-child`
2. `wait_for` → detail du skill visible (description longue, parametres, exemples)

**Resultat attendu** : Le detail du skill selectionne s'affiche. On voit : le nom complet, une description detaillee, les parametres requis (le cas echeant), et un bouton "Executer".
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-28_skill-detail.png`

---

### Etape 29 : Executer un skill

**Priorite** : P1

**Actions Chrome MCP** :
1. Remplir les parametres requis du skill (si formulaire present)
2. `click` → `[data-testid="skill-execute-btn"]` | fallback : `button:has-text("Executer")`, `button:has-text("Lancer")`
3. `wait_for` → resultat du skill visible (texte genere, fichier telecharge, ou apercu)

**Resultat attendu** : Le skill s'execute. Un resultat est retourne (document genere, texte, ou confirmation). Pas de message d'erreur 500. Le temps d'execution est raisonnable (<30s pour la plupart des skills).
**Etats testes** : filled | loading
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-29_skill-execute.png`

**Note** : Certains skills generent un fichier (DOCX, XLSX, PPTX). Verifier que le telechargement se declenche ou qu'un apercu est affiche.

---

### Etape 30 : Tentative acces /admin (RBAC)

**Priorite** : P0

**Actions Chrome MCP** :
1. `navigate` → `http://localhost:8880/admin`
2. `wait_for` → redirection vers /chat OU page 403 OU message "Acces interdit"

**Resultat attendu** : L'agent est redirige vers /chat (ou une page d'erreur). Il ne voit PAS le dashboard admin. Pas de donnees admin visibles (liste users, logs, etc.).
**Etats testes** : rbac
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-30_admin-interdit.png`

**CRITIQUE** : Si l'agent accede au dashboard admin, c'est une faille RBAC majeure. Stopper le protocole et remonter immediatement.

---

### Etape 31 : Tentative API /api/admin/users (RBAC backend)

**Priorite** : P0

**Actions Chrome MCP** :
1. `evaluate_script` → `fetch('/api/admin/users', {headers: {'Authorization': 'Bearer ' + localStorage.getItem('token')}}).then(r => r.status)`
2. `wait_for` → resultat de l'evaluation

**Fallback CLI** :
```bash
curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:8880/api/admin/users \
  -H "Authorization: Bearer $AGENT_TOKEN"
# Doit retourner 403
```

**Resultat attendu** : L'API retourne un code HTTP 403 Forbidden. Aucune donnee utilisateur n'est retournee dans le corps de la reponse.
**Etats testes** : rbac
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-31_api-admin-403.png`

**Verification etendue** : Tester aussi les autres endpoints admin :
```bash
# Tous doivent retourner 403
curl -s -o /dev/null -w "%{http_code}" http://localhost:8880/api/admin/audit-log -H "Authorization: Bearer $AGENT_TOKEN"
curl -s -o /dev/null -w "%{http_code}" http://localhost:8880/api/admin/org/settings -H "Authorization: Bearer $AGENT_TOKEN"
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8880/api/admin/users -H "Authorization: Bearer $AGENT_TOKEN" -d '{}'
curl -s -o /dev/null -w "%{http_code}" -X DELETE http://localhost:8880/api/admin/users/1 -H "Authorization: Bearer $AGENT_TOKEN"
```

**CRITIQUE** : Tout code different de 403 est une faille de securite.

---

### Etape 32 : Recherche globale Ctrl+K

**Priorite** : P2

**Actions Chrome MCP** :
1. `press_key` → `Control+k` (ou `Meta+k` sur Mac)
2. `wait_for` → modale de recherche globale visible | fallback : `[role="dialog"]`, `.search-modal`, `.command-palette`
3. `fill` → champ de recherche → `urbanisme`
4. `wait_for` → resultats de recherche (taches, contacts, conversations)

**Resultat attendu** : La palette de commandes / recherche globale s'ouvre. La recherche "urbanisme" retourne la tache creee a l'etape 16. Les resultats sont cliquables et menent vers l'element correspondant.
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-32_recherche-globale.png`

**Note** : Si Ctrl+K ne fonctionne pas, chercher un bouton de recherche dans la NavBar (`button[aria-label="Rechercher"]`, icone loupe).

---

### Etape 33 : Mentions legales /legal

**Priorite** : P2

**Actions Chrome MCP** :
1. `navigate` → `http://localhost:8880/legal`
2. `wait_for` → page chargee avec du contenu textuel

**Resultat attendu** : La page des mentions legales s'affiche. Elle contient au minimum : l'editeur, l'hebergeur, les conditions d'utilisation de l'IA, la politique de donnees. La page est accessible sans authentification OU avec authentification agent.
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-33_mentions-legales.png`

**Note** : Si /legal n'existe pas encore, verifier /about, /terms, ou un lien en bas de page (footer).

---

### Etape 34 : Deconnexion

**Priorite** : P0

**Actions Chrome MCP** :
1. Chercher le bouton de deconnexion : menu profil, icone, ou lien
2. `click` → bouton deconnexion | fallback : `button:has-text("Deconnexion")`, `button:has-text("Se deconnecter")`, `a[href="/logout"]`
3. `wait_for` → redirection vers /login

**Resultat attendu** : L'utilisateur est deconnecte. Le JWT est supprime de localStorage. La page /login s'affiche. La NavBar n'est plus visible.
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-34_deconnexion.png`

**Verification supplementaire** : DevTools > Application > Local Storage → cle `token` ou `access_token` absente.

---

### Etape 35 : Verifier protection route /chat (non auth)

**Priorite** : P0

**Actions Chrome MCP** :
1. `navigate` → `http://localhost:8880/chat`
2. `wait_for` → redirection vers /login

**Resultat attendu** : L'utilisateur non authentifie est redirige vers /login. Il ne voit pas la page /chat ni la NavBar. Aucune donnee de la session precedente n'est visible.
**Etats testes** : rbac
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-35_chat-redirect-login.png`

**Verification etendue** : Tester aussi les autres routes protegees :
```bash
# Sans token, toutes doivent rediriger ou retourner 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:8880/api/chat/conversations
curl -s -o /dev/null -w "%{http_code}" http://localhost:8880/api/tasks
curl -s -o /dev/null -w "%{http_code}" http://localhost:8880/api/crm/contacts
curl -s -o /dev/null -w "%{http_code}" http://localhost:8880/api/board/advisors
curl -s -o /dev/null -w "%{http_code}" http://localhost:8880/api/skills/list
# Tous doivent retourner 401 ou 403
```

---

## Tests supplementaires multi-tenant

Ces tests verifient l'isolation des donnees entre utilisateurs. A executer apres les 35 etapes principales, avec un second compte (`agent2@therese.local` / `agent2`, meme organisation ou organisation differente).

---

### Etape MT-1 : Isolation des taches

**Priorite** : P0

**Actions** :
1. Se connecter en tant que `agent2@therese.local`
2. Naviguer vers /tasks
3. Verifier que la tache "Preparer dossier urbanisme" (creee par agent1) n'est PAS visible

**Resultat attendu** : La liste des taches de agent2 est vide (ou ne contient que ses propres taches). Les taches de agent1 sont invisibles.
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-MT1_isolation-tasks.png`

**CRITIQUE** : Si les taches d'un autre utilisateur sont visibles, c'est un defaut d'isolation multi-tenant (IDOR).

---

### Etape MT-2 : Isolation des contacts

**Priorite** : P0

**Actions** :
1. (Toujours connecte en tant que agent2)
2. Naviguer vers /crm
3. Verifier que le contact "Marie Lambert" (cree par agent1) n'est PAS visible

**Resultat attendu** : La liste des contacts de agent2 ne contient pas "Marie Lambert".
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-MT2_isolation-crm.png`

---

### Etape MT-3 : Isolation des conversations

**Priorite** : P0

**Actions** :
1. (Toujours connecte en tant que agent2)
2. Naviguer vers /chat
3. Verifier que la conversation de agent1 n'est PAS visible dans la liste

**Resultat attendu** : agent2 voit uniquement ses propres conversations. Aucun message de agent1 n'est accessible.
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-MT3_isolation-chat.png`

---

### Etape MT-4 : Isolation API directe (IDOR)

**Priorite** : P0

**Actions** :
```bash
# Recuperer l'ID d'une tache de agent1
TASK_ID=$(curl -s http://localhost:8880/api/tasks \
  -H "Authorization: Bearer $AGENT1_TOKEN" | jq '.[0].id')

# Tenter d'y acceder avec le token de agent2
curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:8880/api/tasks/$TASK_ID \
  -H "Authorization: Bearer $AGENT2_TOKEN"
# Doit retourner 404 ou 403, PAS 200
```

**Resultat attendu** : L'API retourne 404 (Not Found) ou 403 (Forbidden) quand agent2 tente d'acceder a une ressource de agent1 par son ID.
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-MT4_idor-api.png`

**CRITIQUE** : Un retour 200 avec les donnees de agent1 est une faille IDOR. Stopper et remonter immediatement.

---

## Tests de charte IA complementaires

---

### Etape CH-1 : Charte bloquante - acces direct /chat sans charte

**Priorite** : P0

**Pre-requis** : Reinitialiser l'acceptation de la charte pour l'agent de test.

**Actions** :
1. Se connecter
2. Avant d'accepter la charte, tenter de cliquer sur un lien de la NavBar (si visible)
3. Verifier que la modale de charte reste affichee et bloque toute interaction

**Resultat attendu** : Tant que la charte n'est pas acceptee, l'utilisateur ne peut pas interagir avec l'application. La modale reste en premier plan. Les clics en dehors ne la ferment pas. Les raccourcis clavier (Ctrl+K, etc.) sont inactifs.
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-CH1_charte-bloquante.png`

---

### Etape CH-2 : Charte persistante apres refresh

**Priorite** : P1

**Actions** :
1. Accepter la charte
2. Rafraichir la page (F5)
3. Verifier que la charte ne se reaffiche PAS

**Resultat attendu** : Apres acceptation, la charte ne se reaffiche pas meme apres un rafraichissement. L'etat est persiste cote serveur (pas seulement localStorage).
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-CH2_charte-persistante.png`

---

## Tests de templates complementaires

---

### Etape TP-1 : Templates publics visibles par l'agent

**Priorite** : P1

**Actions** :
1. Lister les templates via API
2. Verifier que seuls les templates marques comme "publics" sont retournes
3. Verifier qu'aucun template "admin-only" n'est visible

**Verification API** :
```bash
curl -s http://localhost:8880/api/chat/templates \
  -H "Authorization: Bearer $AGENT_TOKEN" | jq '.[].name'
# Verifier : pas de template avec "admin" ou "configuration" dans le nom
```

**Resultat attendu** : L'agent voit uniquement les templates destines au role "agent" ou "public". Les templates d'administration sont masques.
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S1-TP1_templates-publics.png`

---

## Recapitulatif par priorite

| Priorite | Etapes | Total | Description |
|----------|--------|-------|-------------|
| P0 | 1, 3, 4, 5, 6, 7, 9, 11, 12, 15, 16, 17, 19, 20, 21, 23, 24, 25, 26, 30, 31, 34, 35, MT-1, MT-2, MT-3, MT-4, CH-1 | 28 | Bloquants - doivent passer avant toute release |
| P1 | 2, 8, 13, 14, 18, 22, 27, 28, 29, CH-2, TP-1 | 11 | Importants - doivent passer avant la demo client |
| P2 | 10, 32, 33 | 3 | Souhaitables - a corriger quand possible |

## Recapitulatif par module

| Module | Etapes | Couverture |
|--------|--------|------------|
| Auth / Login | 1-4, 34-35 | Formulaire, erreurs, JWT, redirect |
| Charte IA | 5-6, CH-1, CH-2 | Modale, acceptation, persistance, blocage |
| Chat | 8-14 | Conversations, messages, streaming, templates |
| Taches | 15-18 | CRUD, completion |
| Contacts CRM | 19-22 | CRUD, recherche |
| Board | 23-25 | Question, deliberation, resultats |
| Skills | 26-29 | Liste, detail, execution |
| RBAC | 7, 30-31 | NavBar, redirect, API 403 |
| Multi-tenant | MT-1 a MT-4 | Isolation taches, contacts, chat, IDOR |
| UX | 10, 32-33 | Placeholder, recherche globale, mentions legales |

## Criteres de reussite globaux

- **100% des P0 passent** : obligatoire pour toute release
- **90% des P1 passent** : obligatoire avant demo client
- **Zero faille RBAC** : aucun acces admin, aucune donnee cross-tenant
- **Streaming fonctionnel** : chat et board repondent sans erreur 500
- **Charte bloquante** : impossible d'utiliser l'app sans acceptation

## Notes d'execution

1. **Ordre** : Executer les etapes dans l'ordre (1 a 35 puis MT puis CH puis TP). Les etapes sont sequentielles (chaque etape depend des precedentes).
2. **Reinitialisation** : Entre deux passages complets, reinitialiser le compte agent (supprimer taches, contacts, conversations) ou utiliser un nouveau compte.
3. **Screenshots** : Capturer systematiquement en cas de FAIL. Le nom du fichier inclut le numero d'etape et un slug descriptif.
4. **Timeout** : Les etapes de streaming (11, 24-25, 29) necessitent des timeouts plus longs (60-90s).
5. **DevTools** : Garder la console Chrome ouverte pendant toute l'execution. Toute erreur JS rouge est a documenter.
6. **Reseau** : Surveiller l'onglet Network pour les erreurs 4xx/5xx inattendues.
