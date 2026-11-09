# Gardons-stats

Stats de hockey pour l'équipe Gardons. Application web installable (PWA), hébergée sur GitHub Pages, données dans Firebase.

- Lecture publique : toute personne ayant le lien voit les stats, sans connexion.
- Écriture : uniquement le compte Google admin (UID défini dans `index.html` et `firestore.rules`).
- Hors ligne : les saisies sont gardées sur l'appareil puis envoyées au retour du réseau.

## Fichiers

- `index.html` : toute l'application (HTML, CSS, JS).
- `export-match.js` : export Excel d'un match et de la saison.
- `sw.js`, `manifest.json`, icônes : mode hors ligne et installation sur l'iPad.
- `firestore.rules` : règles de sécurité de la base.

## Mise à jour

Pousser sur `main`. Après un déploiement, recharger l'application deux fois pour voir la nouvelle version.
