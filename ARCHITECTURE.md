# Swifty Proteins — Architecture & fonctionnement

Document destiné à un développeur qui reprend le projet. Il explique **les choix
d'architecture, le pourquoi de chaque décision, et le flux complet** de l'application.

---

## 1. Vue d'ensemble

Swifty Proteins est un visualiseur 3D de ligands (petites molécules issues de la
Protein Data Bank). L'utilisateur s'authentifie (mot de passe ou biométrie),
parcourt une liste de ~1240 ligands, en sélectionne un, et l'application télécharge
puis affiche sa structure 3D (modèle *ball-and-stick*, couleurs CPK) avec laquelle
il peut interagir (rotation, zoom, sélection d'atome, partage d'une capture).

### Stack technique

| Domaine | Choix | Raison |
|---|---|---|
| Framework | **Expo + React Native** (multiplateforme) | Une seule base de code iOS/Android/web ; le sujet autorise React Native. |
| Routing | **expo-router** (file-based) | Routing déclaratif par fichiers dans `app/`, typé. |
| Langage | **TypeScript** (`strict`) | Sûreté de types sur le parsing CIF et les messages du viewer. |
| Auth / stockage | **expo-secure-store** + **bcryptjs** + **expo-local-authentication** | Keychain/Keystore natif, hash de mot de passe, biométrie. |
| Rendu 3D | **three.js** dans une **WebView** (natif) / **iframe** (web) | Voir §6 — c'est le cœur du projet. |
| Partage | **expo-sharing** (natif) / téléchargement (web) | Share sheet natif. |

> **Important** : le projet cible des *dev builds* (`expo run:android` / `run:ios`)
> ou Expo Go sur appareil réel. La biométrie et le SecureStore avec
> `requireAuthentication` ne fonctionnent pas en émulateur web — la version web sert
> surtout au développement et comme bonus multiplateforme.

---

## 2. Structure du projet

```
app/                       # Écrans (routes expo-router)
  _layout.tsx              # Stack de navigation + ré-affichage du login au retour de background
  index.tsx                # Redirige vers /login
  login.tsx                # Connexion (mot de passe + biométrie)
  signup.tsx               # Inscription
  home.tsx                 # Liste des ligands + recherche
  protein.tsx              # Vue 3D d'un ligand
  +not-found.tsx           # 404 de navigation

components/
  MoleculeView.tsx         # Viewer 3D — implémentation NATIVE (react-native-webview)
  MoleculeView.web.tsx     # Viewer 3D — implémentation WEB (<iframe>)
  MoleculeView.types.ts    # Types partagés des deux implémentations

tools/                     # Logique métier pure (testable hors UI)
  user.tsx                 # Auth : hash, stockage, biométrie
  utils.tsx               # Helpers (validation alphanumérique)
  cif.ts                   # Téléchargement + parsing des fichiers .cif RCSB
  cpk.ts                   # Table CPK (couleurs + rayons atomiques)
  cache.ts                 # Cache mémoire des molécules parsées
  moleculeViewer.ts        # Générateur du HTML three.js du viewer
  three.bundle.ts          # three.js bundlé (base64) — fichier généré

assets/
  ligands.txt              # Liste des identifiants de ligands (1 par ligne)
```

**Principe de séparation** : tout ce qui est **logique pure** (réseau, parsing,
auth, génération du viewer) vit dans `tools/` sans dépendance à React. Les écrans
(`app/`) ne font qu'orchestrer cet état et le rendu. Cela rend la logique testable
en isolation (cf. §11) et garde les composants fins.

---

## 3. Navigation & flux global

```
index ──redirect──▶ login ──┬─(mdp OK / biométrie OK)─▶ home ──(tap ligand)─▶ protein
                            │                                                    │
                            └──────────────◀── logout ── home ◀── back ──────────┘
```

`app/_layout.tsx` définit une `Stack` (headers masqués) et applique **l'exigence de
sécurité du sujet** : le login doit réapparaître à chaque retour de premier plan.

```ts
// app/_layout.tsx
AppState.addEventListener("change", (next) => {
  if (appState.current.match(/inactive|background/) && next === "active") {
    router.replace("/login"); // re-login forcé
  }
});
```

Conséquence assumée : après un partage (la share sheet met l'app en `inactive`),
l'utilisateur repasse par le login. C'est conforme à l'exigence « le login doit
TOUJOURS s'afficher au retour de background ».

---

## 4. Authentification & sécurité (`tools/user.tsx`)

### 4.1 Stockage et hash des mots de passe

- Les mots de passe ne sont **jamais stockés en clair**. À l'inscription, le mot de
  passe est hashé avec **bcrypt** (10 rounds) puis l'objet `{username, passwordHash}`
  est sérialisé dans le stockage sécurisé sous la clé `USER_<username>`.

```ts
export async function saveUser(username, password) {
  const passwordHash = await hashPassword(password); // bcrypt
  await setStoredValue(getUserKey(username), JSON.stringify({ username, passwordHash }));
}
```

- **Abstraction de stockage** : `setStoredValue`/`getStoredValue` utilisent
  `expo-secure-store` sur natif (Keychain iOS / Keystore Android) et `localStorage`
  sur web (le SecureStore n'existe pas en navigateur). C'est ce qui permet à la
  version web de fonctionner pour le dev.

- bcrypt en React Native n'a pas de source d'entropie native : on branche
  `expo-crypto` comme fallback aléatoire (`bcrypt.setRandomFallback`).

### 4.2 Règles de validation

- Username : alphanumérique (`tools/utils.tsx`).
- Mot de passe (`validatePassword`) : ≥ 8 caractères, au moins une majuscule, une
  minuscule et un chiffre. La validation est faite **avant** tout accès au stockage.

### 4.3 Biométrie — liée à un compte précis

Modèle clé : **chaque compte possède sa propre entrée biométrique** dans le
keychain, déverrouillable uniquement par la biométrie de l'appareil.

```ts
// Clé par-compte
getBiometricCredentialKey(username) => `BIOMETRIC_CREDENTIAL_<username>`

// Enregistrement (après un authenticateAsync réussi)
SecureStore.setItemAsync(getBiometricCredentialKey(username), username, {
  requireAuthentication: true,                       // déverrouillage = biométrie
  keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY // ne quitte jamais l'appareil
});

// Vérification au login : lire l'entrée du compte déclenche le prompt biométrique
verifyBiometricAuthenticatedUser(username) =>
  SecureStore.getItemAsync(getBiometricCredentialKey(username), {requireAuthentication:true})
    === username
```

Nuances à connaître :

1. Une clé **globale** `BIOMETRIC_AUTHENTICATED_USER` retient le **dernier** compte
   ayant activé la biométrie ; elle sert uniquement à **pré-suggérer** ce compte sur
   l'écran de login. On peut se connecter en biométrie à n'importe quel compte
   enregistré en tapant son username.
2. La biométrie protège **l'appareil**, pas un compte en particulier : toute
   empreinte/visage enrôlé déverrouille le keychain. Le lien au compte se fait via
   *quelle entrée keychain est lue*. C'est le modèle standard.
3. `isBiometricAvailable()` renvoie `false` si pas de hardware/enrôlement (et
   toujours sur web) → le bouton biométrie est masqué sur l'écran de login.

---

## 5. Données : téléchargement & parsing CIF (`tools/cif.ts`)

### 5.1 Source

Les fichiers `.cif` sont téléchargés depuis l'URL standard du sujet :
`https://files.rcsb.org/ligands/view/{id}.cif`.

`fetchLigandCif` utilise un **AbortController** pour un timeout (15 s) et **mappe
toutes les erreurs** en codes typés exploitables par l'UI :

```ts
type CifErrorCode = "NO_NETWORK" | "NOT_FOUND" | "TIMEOUT" | "PARSE" | "UNKNOWN";
```

`cifErrorMessage(error)` traduit ces codes en messages utilisateur conformes au
sujet (« No internet connection », « Ligand not found (404) », « Request timeout »,
« Failed to parse ligand data »).

### 5.2 Parsing — le format CIF a deux formes

Le parser extrait deux catégories : `_chem_comp_atom` (atomes + coordonnées) et
`_chem_comp_bond` (liaisons + ordre). Subtilité **critique** : le CIF a deux mises
en forme selon le nombre de lignes.

- **Forme `loop_`** (cas général, plusieurs atomes) : un en-tête de colonnes suivi
  de lignes de données. Géré par `parseLoops`.
- **Forme clé-valeur** (ligand **mono-atomique**, ex. un ion `CA`, `ZN`) : pas de
  `loop_`, mais des paires `_chem_comp_atom.atom_id CA`. Géré par `parseSingleRow`.

> ⚠️ Sans le support de la 2ᵉ forme, l'app **crashe** sur les ions mono-atomiques —
> exactement le genre de bug éliminatoire que le sujet sanctionne. Les deux formes
> sont gérées en fallback : `parseLoops(...) ?? parseSingleRow(...)`.

Autres points de robustesse :

- **Tokenizer respectant les quotes** : les `atom_id` peuvent contenir des
  apostrophes (`O5'`, `C5'`) ou être entre guillemets ; un split naïf casserait.
- **Coordonnées idéales en priorité** (`pdbx_model_Cartn_*_ideal`) avec **fallback**
  sur les coordonnées du modèle (`model_Cartn_*`). Les valeurs `?`/`.` sont ignorées.
- **Liaisons filtrées** : on ne garde que les liaisons dont les deux atomes existent.
- Mapping des colonnes par **suffixe** (`columnIndex(columns, "atom_id")`) : robuste
  même si l'ordre ou le nombre de colonnes varie d'un fichier à l'autre.

Sortie : un objet `Molecule = { id, atoms: Atom[], bonds: Bond[] }` indépendant du
rendu.

### 5.3 Couleurs & rayons (`tools/cpk.ts`)

`getElementInfo(symbol)` renvoie `{ color, radius, name }` pour chaque élément selon
le schéma **CPK** standard (C gris, H blanc, O rouge, N bleu, S jaune, P orange…),
plus de nombreux métaux. Tout élément inconnu retombe sur une **sphère rose** (le
sujet autorise un fallback). Les `radius` sont des rayons de van der Waals,
réutilisés pour le modèle *space-filling*.

### 5.4 Cache (`tools/cache.ts`)

`getMolecule(id)` mémorise les molécules parsées dans une `Map` en mémoire. Cela
permet deux choses :

1. **Charger sur l'écran liste avant de naviguer** : le `home` appelle
   `getMolecule` (indicateur de chargement visible sur la liste) puis pousse vers
   `/protein` ; la vue 3D récupère la molécule déjà parsée via `peekMolecule`.
2. Re-consulter un ligand déjà vu sans re-télécharger pendant la session.

```
home: tap ──▶ getMolecule(id)  ──(loader sur la liste)──▶ router.push(/protein?id)
protein: peekMolecule(id) ?? getMolecule(id)  ──▶ rendu
```

---

## 6. Le viewer 3D — le choix d'architecture central

### 6.1 Pourquoi une WebView + three.js (et pas du natif) ?

Le sujet interdit les game engines (Unity/Unreal) et demande un framework 3D
intégré. En React Native multiplateforme, les options étaient :

- **react-native-filament / expo-gl + three** : natif, performant, mais setup lourd
  et compatibilité plus fragile avec la *new architecture* / React 19.
- **WebView + three.js** : three.js est la librairie 3D la plus mature et
  documentée ; l'exécuter dans une WebView donne un rendu identique sur iOS et
  Android, fonctionne aussi sur web, et isole proprement le moteur 3D du reste de
  l'app. C'est le choix retenu.

### 6.2 Le viewer est un HTML auto-contenu généré (`tools/moleculeViewer.ts`)

`buildViewerHtml(payload)` produit **un document HTML complet** (three.js + scène +
contrôles + logique) en une seule string. Les données de la molécule et les couleurs
**sont calculées côté React Native** (source de vérité unique dans `cpk.ts`) puis
injectées en JSON ; le HTML n'est qu'un *renderer* sans logique métier.

```
Molecule ──buildViewerPayload(cpk)──▶ { atoms:[{x,y,z,couleur,rayon}], bonds:[{a,b,ordre}] }
                                          │ JSON.stringify
                                          ▼
                             buildViewerHtml ──▶ <html> three.js auto-contenu </html>
```

### 6.3 three.js embarqué en data-URL (offline)

**Problème** : pour que le rendu marche **hors-ligne** (et sans dépendre d'un CDN),
three.js doit être embarqué dans le HTML. three.js moderne ne fournit que des
modules ES, et `three.module.min.js` **n'est pas auto-contenu** : il fait
`import "./three.core.min.js"` — un import relatif **impossible à résoudre depuis une
data-URL** (le schéma `data:` n'est pas hiérarchique). C'est un piège qui échoue
aussi bien dans le navigateur que sur l'appareil.

**Solution** : on bundle d'abord three.js en **un seul fichier** avec esbuild, puis
on l'encode en base64 dans `tools/three.bundle.ts`, et le HTML l'importe via une
data-URL :

```js
import * as THREE from 'data:text/javascript;base64,<bundle>';
```

Régénération (après une mise à jour de three) — commande documentée en tête de
`tools/three.bundle.ts` :

```bash
npx esbuild node_modules/three/build/three.module.js --bundle --format=esm \
  --minify --legal-comments=none --outfile=three.bundled.js
# puis encoder three.bundled.js en base64 dans THREE_MODULE_BASE64
```

> On n'utilise **pas** d'`importmap` : comme on importe directement la data-URL (et
> qu'on a écrit nos propres contrôles caméra, donc pas besoin d'`OrbitControls` qui
> ferait un `import 'three'`), on évite l'importmap qui limiterait la compatibilité
> aux navigateurs récents (iOS ≥ 16.4). L'import data-URL est supporté beaucoup plus
> largement.

### 6.4 Contenu de la scène (dans le HTML généré)

- **Modèle ball-and-stick** : atomes = sphères (rayon ∝ rayon atomique), liaisons =
  cylindres bicolores (chaque moitié à la couleur de son atome), plus fins que les
  sphères.
- **Couleurs CPK** passées par atome.
- **Centrage** sur le barycentre + **cadrage caméra** calculé à partir du rayon
  englobant **et du ratio d'aspect** (en portrait, c'est l'horizontale qui limite —
  sinon la molécule dépasse de l'écran). Recadrage au resize (rotation d'écran).
- **Éclairage** : ambiante + 2 lumières directionnelles (relief, pas d'aplat).
- **Modèles alternatifs** (bonus) : `space-filling` (sphères van der Waals, sans
  liaisons), `wireframe` (liaisons fines, sans sphères), `stick`.

### 6.5 Interactions (contrôles tactiles maison)

Plutôt qu'`OrbitControls`, des handlers `pointer*` gèrent :

- **1 doigt** : rotation (on tourne un groupe pivot, pas la caméra).
- **2 doigts** : pinch = zoom (dolly caméra entre `minDist`/`maxDist`), déplacement
  du milieu = pan.
- **Tap** (down→up court et sans déplacement) : **raycasting** pour sélectionner
  l'atome sous le doigt → surbrillance (emissive) + message vers l'app. Tap dans le
  vide → désélection.

### 6.6 Communication app ↔ viewer

Le viewer émet des messages JSON typés (`ViewerMessage` : `ready`, `select`,
`deselect`, `screenshot`, `error`). Le canal diffère selon la plateforme, d'où la
fonction `send()` polymorphe :

```js
function send(msg) {
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg)); // natif
  else if (window.parent !== window) window.parent.postMessage(JSON.stringify(msg), '*');     // iframe web
}
```

Sens inverse (app → viewer, ex. demande de capture) : injection JS sur natif,
`iframe.contentWindow.postMessage` sur web.

### 6.7 Composant à variantes de plateforme

`react-native-webview` **n'existe pas sur web**. On utilise donc la résolution de
plateforme de Metro :

- `components/MoleculeView.tsx` → natif, rend un `<WebView>`.
- `components/MoleculeView.web.tsx` → web, rend un `<iframe srcDoc={html}>`.
- `components/MoleculeView.types.ts` → interface commune (`MoleculeViewProps`,
  `MoleculeViewHandle` avec `requestScreenshot()`), pour que `tsc` et les deux
  implémentations partagent les mêmes types.

Metro choisit automatiquement `.web.tsx` pour le web et `.tsx` sinon. `protein.tsx`
importe simplement `@/components/MoleculeView` sans se soucier de la plateforme.

### 6.8 Partage

L'écran demande une capture (`requestScreenshot`). Le viewer rend la frame puis
renvoie un PNG en data-URL (`renderer.domElement.toDataURL`, activé par
`preserveDrawingBuffer: true`). Côté app :

- **natif** : on écrit le PNG en fichier (`expo-file-system`) puis on ouvre la share
  sheet (`expo-sharing`).
- **web** : on déclenche un téléchargement via un `<a download>`.

---

## 7. Gestion d'erreurs & feedback (exigence forte du sujet)

- **Réseau/parsing** : toutes les erreurs de chargement d'un ligand sont typées
  (`CifError`) puis affichées via `cifErrorMessage` — sur la liste (sélection) et sur
  l'écran 3D (overlay « … » + bouton *Go back*).
- **Indicateurs de chargement** : `ActivityIndicator` sur la cellule en cours de
  chargement (liste) et overlay plein écran (vue 3D).
- **Pas de crash sur cas limites** : ligand mono-atomique, coordonnées manquantes,
  élément inconnu, molécule volumineuse — tous gérés.
- **Piège web — `Alert.alert` est bloquant** : sur react-native-web, `Alert.alert`
  devient un `window.alert()` qui **gèle la page**. Tous les appels `Alert` sont donc
  gardés par `Platform.OS !== "web"`, et l'app affiche un **message inline** à la
  place sur web.

---

## 8. Considérations multiplateforme (résumé)

| Aspect | Natif (iOS/Android) | Web |
|---|---|---|
| Stockage sécurisé | expo-secure-store (Keychain/Keystore) | `localStorage` |
| Biométrie | expo-local-authentication | indisponible (bouton masqué) |
| Viewer 3D | `WebView` | `<iframe>` |
| Canal de messages | `ReactNativeWebView.postMessage` | `window.parent.postMessage` |
| Partage | share sheet (`expo-sharing`) | téléchargement PNG |
| Alertes | `Alert.alert` natif | message inline (Alert bloquant évité) |

---

## 9. Sécurité — points clés

- Mots de passe **hashés bcrypt**, jamais en clair.
- Stockage **sécurisé natif** (Keychain/Keystore), entrées biométriques en
  `WHEN_UNLOCKED_THIS_DEVICE_ONLY` + `requireAuthentication`.
- **Pas de session persistante** : le login est re-demandé à chaque retour de
  premier plan ; il n'y a pas de « rester connecté ».
- Données réseau **validées au parsing** (coordonnées finies, liaisons cohérentes).
- WebView en HTML local uniquement (`source={{ html }}`), pas de navigation distante.

---

## 10. Limites connues & compromis assumés

- **Changement de modèle** (ball-stick → space-filling…) : recharge le HTML du
  viewer, donc **réinitialise l'orientation/zoom**. Fonctionnel mais perfectible si
  on veut basculer « sans recharger » (il faudrait piloter le changement via
  `postMessage` plutôt que régénérer le HTML).
- **Zoom molette** non géré sur web (seulement pinch tactile) — sans impact mobile.
- Bouton « Activer la biométrie » visible à l'inscription même sur web (où elle est
  indisponible) ; il affiche un message si on l'active sans support.
- **Icône d'app & splash thématiques** : encore les assets Expo par défaut, à
  remplacer.
- Le bundle three.js en base64 (~970 Ko) alourdit le HTML du viewer (~1,4 Mo) ;
  acceptable car local et chargé une fois, mais c'est le prix du 100 % hors-ligne.

---

## 11. Tester, lancer, vérifier

### Lancer

```bash
npm install
npx expo start            # puis Expo Go / dev build sur appareil réel
npx expo start --web      # version web (dev) — sur Windows, ajouter --clear si le
                          # watcher Metro rate des modifs
```

### Qualité

```bash
npx tsc --noEmit          # typage
npx expo lint             # lint
```

### Tester la logique pure hors UI

Les modules `tools/cif.ts`, `cpk.ts`, `moleculeViewer.ts` n'ont **aucune dépendance
React** : on peut les compiler avec `tsc` et les exécuter sous Node pour tester le
parsing contre de vrais fichiers RCSB (fetch + `parseCif` + `buildViewerHtml`), y
compris les cas limites (ions mono-atomiques, 404, timeout). Le HTML généré, étant
auto-contenu, peut aussi être ouvert tel quel dans un navigateur pour valider le
rendu visuellement.

---

## 12. Pour aller plus loin (idées d'évolution)

- Cache **disque** des `.cif` (`expo-file-system`) pour un vrai mode hors-ligne
  persistant entre sessions.
- Changement de modèle **sans rechargement** (message `setModel` au viewer).
- Favoris, labels d'atomes, mesure de distances/angles (bonus du sujet).
- Plusieurs comptes biométriques mémorisés (au lieu d'un seul suggéré par défaut).
- Icône/splash thématiques moléculaires.
```
