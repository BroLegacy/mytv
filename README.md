# MyTV

Écran d'accueil perso pour TV Samsung Tizen (testé visé : Q67BA, Tizen 6.5) :
étagère d'apps, chaînes IPTV (M3U), thèmes, halo lumineux, mises à jour auto.

## Installer avec TizenBrew
1. TV : Applications → tape `1 2 3 4 5` à la télécommande → Developer mode ON → IP de ton PC → redémarre la TV.
2. PC (même Wi-Fi) : installe TizenBrew Installer et connecte-toi à la TV.
3. Dans TizenBrew sur la TV : Module Manager → Add GitHub module → `BroLegacy/mytv`.
4. Lance MyTV depuis la liste. Réglages → Autorun Last App pour démarrer dessus.

## Mises à jour
Pousse sur `main`, incrémente `version` dans `package.json` et `version.json`. TizenBrew récupère la nouvelle version ; l'écran Réglages indique aussi quand une version est disponible.

## Personnaliser
Apps de l'étagère : `FAV_APPS` dans `js/app.js` (IDs visibles dans « Toutes les applications »). Thèmes : variables dans `css/style.css`.
