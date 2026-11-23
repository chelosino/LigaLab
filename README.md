# LigaLab Live — versión para Vercel

Paquete preparado para desplegar, aún no publicado ni validado en la infraestructura de Vercel. Frontend en public/, función Node en api/index.js y extracción en lib/. No se necesita Python, base de datos ni claves para la fuente actual. No ejecutar el build del paquete anterior de Sites.

## Opción 1: GitHub + Vercel

1. Sube el contenido de esta carpeta a la raíz de un repositorio GitHub.
2. En Vercel: Add New → Project → importa ese repositorio.
3. Selecciona la cuenta/equipo que corresponda. Framework Preset: Other. Root Directory: la carpeta que contiene vercel.json (la raíz si subiste este paquete directamente).
4. vercel.json configura Output Directory como public, sin Build Command, y una función Node de hasta 30 segundos. Node.js: 22.x. No hay variables de entorno requeridas.
5. Pulsa Deploy. Verifica que /api/league?league=chile devuelva JSON y que la página muestre CONECTADO y 240 partidos del calendario de Chile de la temporada verificada.
6. Cambia a Inglaterra y comprueba también /api/league?league=england. El proveedor puede bloquear o responder distinto desde un centro de datos: esta prueba debe hacerse en el despliegue, no basta el test local.

## Opción 2: terminal

Desde esta carpeta, con Node.js instalado:

```powershell
npx vercel login
npx vercel
```

Elige tu cuenta/equipo y un proyecto nuevo llamado ligalab-live. Acepta la configuración del archivo vercel.json. El segundo comando crea un preview. Comprueba la tabla, API y cambio de liga en esa URL. Para publicar producción:

```powershell
npx vercel --prod
```

Vercel entrega la URL del despliegue. No pegues tokens en el chat; el login se hace en tu navegador. También puede importarse desde GitHub para desplegar los próximos cambios al hacer push.

## Datos y actualización

La UI consulta cada 30 segundos mientras está visible. La función hace una petición saliente a LiveScore con timeout de 12 segundos. No requiere cron ni servidor permanente. La caché de 25 segundos y el último resultado son oportunistas, por instancia: se pierden con reinicios y no están compartidos entre instancias de Vercel. Si una instancia nueva no puede consultar la fuente devolverá error; el navegador conserva los datos anteriores ya mostrados y marca el fallo.

Para mayor tráfico conviene agregar una caché compartida antes de aumentar usuarios. Esta entrega no contrata recursos ni garantiza que un plan gratuito cubra cualquier volumen. La frecuencia de consulta del navegador se mantiene, pero la frescura también depende de LiveScore.

La tabla proviene del proveedor e incluye sus ajustes administrativos. Los partidos en vivo no se entrenan como finales; la simulación conserva el marcador parcial y estima goles restantes. Criterios de cupos y desempates siguen siendo aproximaciones configurables.

## Validación local

`npm test` comprueba que la adaptación de rutas preserve la liga seleccionada. El motor y el adaptador de datos son los de la entrega anterior, que pasó 12 pruebas. Falta comprobar el empaquetado y acceso a LiveScore desde Vercel tras el primer despliegue.

Documentación: https://vercel.com/docs/functions/runtimes/node-js y https://vercel.com/docs/project-configuration/vercel-json
