# Publicar la web de KOVO (gratis, sin dominio)

La web es estática: no necesita servidor. Usa GitHub Pages.

## 1. Subir la web
1. Crea una cuenta en github.com.
2. Crea un repositorio **público** llamado `kovo`.
3. Haz clic en **Add file > Upload files**.
4. Arrastra el **contenido** de esta carpeta (no el zip). Incluye `css`, `js`, `assets` y los `.html`.
5. Haz clic en **Commit changes**.
6. Ve a **Settings > Pages**.
7. En Branch elige `main` y `/ (root)`. Haz clic en **Save**.
8. En 1 o 2 minutos tu web estará en `https://TU_USUARIO.github.io/kovo/`.

## 2. Configurar Supabase
En Authentication > URL Configuration:
- **Site URL**: `https://TU_USUARIO.github.io/kovo/`
- **Redirect URLs**: agrega `https://TU_USUARIO.github.io/kovo/**`

Sin esto, el enlace de "olvidé mi contraseña" no llega a tu web.

## 3. Conectar el launcher
En `config.js` del launcher escribe:
`SITE_URL: 'https://TU_USUARIO.github.io/kovo'`

## 4. Publicar el instalador
1. En la carpeta del launcher ejecuta `npm run dist`.
2. El instalador `.exe` queda en la carpeta `dist`.
3. En tu repo de GitHub ve a **Releases > Create a new release**.
4. Sube el `.exe` y publica.
5. Copia el enlace `https://github.com/TU_USUARIO/kovo/releases/latest`.
6. Pégalo en `js/config.js` de la web, en `DOWNLOAD_URL`.
7. Vuelve a subir ese archivo al repo.

## Notas
- Las claves de `js/config.js` son públicas por diseño. Nunca pongas la clave `secret`.
- Windows mostrará "SmartScreen" con instaladores sin firma. Firmar cuesta dinero.
- Cambia los textos de `legal.html` por documentos revisados por un abogado.
