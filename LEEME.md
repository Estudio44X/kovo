# Publicar la web de KOVO (gratis, sin dominio)

La web es estática: no necesita servidor. Usa GitHub Pages.

## Antes de publicar esta versión

1. `legal.html` incluye el correo `kovointeractive@gmail.com` y el dominio que compartiste. Antes de publicar o aceptar cuentas/pagos, una persona adulta debe asumir e identificar al responsable legal, confirmar su domicilio e identificación, elegir los países de venta, verificar Supabase/proveedores y revisar los textos con asesoría local. La identidad del responsable, domicilio, mercados de venta, proveedor de pagos y ajustes reales de Supabase aún no están confirmados; no habilites ventas ni registros públicos hasta resolverlo.
2. Aplica el `supabase/schema.sql` actualizado incluido con el launcher (también se entrega separado) en el SQL Editor de Supabase antes de aceptar registros nuevos. La función de registro exige ambas aceptaciones y guarda fecha del servidor, versiones, canal (web/launcher) y método (dos casillas separadas).
3. El inventario de imágenes está en `RIGHTS_INVENTORY.md`. No publiques recursos cuya procedencia o licencia no puedas acreditar.
4. La web incluida no tiene etiquetas de analítica ni publicidad. Si agregas una, actualiza la política de cookies y configura la elección previa de consentimiento que aplique.
5. La portada nueva toma como referencia la jerarquía de un escaparate editorial de videojuegos: navegación sobrepuesta, carrusel accesible de títulos, arte panorámico a pantalla completa, noticias en composición principal/secundaria y fichas que se revelan al entrar en pantalla. No copia las marcas ni el arte de Rockstar. El carrusel se pausa con el control, al enfocar/usar el puntero y al ocultar la pestaña; respeta `prefers-reduced-motion`. El contenido permanece visible si JavaScript no carga.
6. La nueva portada usa los recursos de marca que adjuntaste. Esto no prueba licencia ni autoría: revisa `RIGHTS_INVENTORY.md` y conserva evidencia para esos archivos y cada portada de juego antes de publicar.
7. `admin.html` es solo para cuentas con `is_admin=true`, asignado desde Discord por un administrador autorizado. El envío requiere bot activo, `DISCORD_GUILD_ID` y la migración de Supabase que crea la cola protegida.

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
- Verifica en producción las cookies del hosting y Supabase. El código fuente revisado no incluye analítica ni cookies publicitarias; la configuración final debe confirmarse antes del lanzamiento.
