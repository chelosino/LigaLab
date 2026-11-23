# LigaLab · simulación personal y administración

Sitio: https://ligalab-tau.vercel.app/ · Administración: https://ligalab-tau.vercel.app/admin

Cada visitante ajusta y simula sus propios pronósticos en un Web Worker de su navegador. No hay endpoint que reciba escenarios ni resultados de simulaciones. Solo se comparten el catálogo de ligas y los datos del proveedor. Los escenarios se conservan en memoria mientras la pestaña permanece abierta.

## Administración

Entra en /admin y solicita un enlace al correo autorizado. Abre el enlace en el mismo navegador donde lo solicitaste (autenticación PKCE). Desde el panel puedes:

- Crear ligas y activar o desactivar las existentes.
- Editar país y liga de LiveScore, número de equipos, puntos y orden de desempates.
- Crear hasta 10 zonas con nombre, color y posiciones inicial/final; pueden solaparse.
- Probar la fuente y ver advertencias antes de guardar.
- Guardar borradores desactivados aunque el calendario esté incompleto.

Solo se admite tabla única con ida y vuelta. Se conserva la clasificación publicada por LiveScore; los criterios configurados se usan para ordenar las simulaciones. No se modelan playoffs, grupos, enfrentamientos directos ni cupos que dependan de otras competiciones. Las zonas iniciales son exploratorias.

Las actualizaciones del catálogo se consultan cada 30 segundos con la pestaña visible. Cambiar las reglas recalcula el escenario personal conservando los marcadores fijados que siguen siendo válidos. Cambiar de liga limpia el escenario.

## Arquitectura y permisos

- public/: interfaz, motor y Web Worker. public/admin.js usa el cliente oficial de Supabase empaquetado por build.mjs.
- api/index.js: adaptador de rutas Vercel, conserva cabeceras y cuerpos.
- lib/api.js: datos públicos y API administrativa; verifica la identidad y el rol antes de leer borradores o guardar.
- lib/catalog.js: validación y acceso a Supabase con clave PUBLICABLE y token del usuario; no usa service_role.
- schema.sql: esquema de referencia para una base nueva. En el proyecto conectado se aplicó mediante migraciones remotas.
- public.ligalab_leagues: catálogo, revisión y fecha de modificación.
- ligalab_private.admins: correos autorizados, inaccesibles al cliente. La autorización comprueba la identidad verificada en auth.users, nunca user_metadata.
- ligalab_private.audit: historial de configuraciones para auditoría; no almacena simulaciones.

La seguridad se aplica también en PostgreSQL mediante RLS. Los visitantes solo leen ligas activas. Las escrituras necesitan una cuenta administradora. La revisión impide sobrescribir cambios de otra sesión. Para retirar una liga se desactiva; no hay borrado permanente en la UI. Añadir administradores requiere modificar la lista privada desde Supabase como propietario.

## Despliegue

Repositorio GitHub chelosino/LigaLab conectado a Vercel. Framework Other, raíz del repositorio, salida public, comando npm run build, Node 22.x. El build empaqueta el SDK de autenticación; las simulaciones siguen siendo código local del navegador.

Variables del servidor: SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY. Copiar .env.example si se configura otro entorno. No introducir claves secretas/service_role en ninguna variable pública.

Configurar en Supabase Authentication > URL Configuration el Site URL con https://tu-dominio/admin. Autorizar el correo administrador en ligalab_private.admins. El envío de enlaces usa Supabase Auth; el servicio de correo predeterminado tiene límites y restricciones de destinatarios. Para ampliar administradores a otros destinatarios puede ser necesario SMTP propio.

## Verificación

npm ci
npm test
npm run build

Las pruebas cubren permisos, validación de fuentes/zonas, conflictos de revisión, rutas con Authorization y cuerpo JSON, motor Poisson y datos en vivo. El acceso real por correo debe probarlo el titular del correo, sin compartir enlaces de acceso.

La fuente se consulta bajo demanda con caché por instancia de 25 segundos, no mediante cron. Un fallo del proveedor se muestra como datos antiguos cuando hay una copia en memoria; si no existe, se informa el error. No se garantiza latencia de LiveScore ni continuidad de su API.
