# Uploads persistants sur Vercel (Vercel Blob)

Sur Vercel, le disque local (`/tmp`) est **éphémère**. Les images uploadées via Multer disparaissent au redéploiement. L’API utilise désormais **Vercel Blob** lorsque `BLOB_READ_WRITE_TOKEN` est présent.

## Configuration (une fois)

1. Ouvrez le projet sur [vercel.com](https://vercel.com).
2. **Storage** → **Create Database / Store** → **Blob**.
3. Liez le store au projet (`Connect to project`).
4. Redéployez : Vercel injecte automatiquement `BLOB_READ_WRITE_TOKEN` sur le service `api`.

Aucune variable manuelle n’est nécessaire si le store est bien lié.

## Vérification

1. Uploadez un logo (admin → branding) ou un avatar.
2. Notez l’URL renvoyée : elle doit ressembler à  
   `https://….public.blob.vercel-storage.com/branding/…`
3. Redéployez le projet, puis rouvrez l’URL : l’image doit toujours s’afficher.

## Limites Vercel (server upload)

Les uploads passent par l’API Express (server upload). Sur Vercel, la taille maximale du corps de requête est d’environ **4,5 Mo** par fichier. Les routes à 10–50 Mo (bibliothèque numérique, e-learning) peuvent échouer sur Vercel ; pour de gros fichiers, prévoir un upload client direct (hors scope actuel) ou un VPS.

## Développement local

Sans `BLOB_READ_WRITE_TOKEN`, les fichiers restent dans `server/uploads/` (comportement habituel).

Pour tester Blob en local : `vercel env pull` puis redémarrer l’API.
