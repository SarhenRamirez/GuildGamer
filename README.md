# GuildGamer

Plataforma social para encontrar jugadores, crear sesiones y comunicarse por texto y voz antes de entrar a jugar. GuildGamer no ejecuta los juegos: organiza al grupo y lo conecta con su juego externo.

| Carpeta     | Stack                                                          |
| ----------- | -------------------------------------------------------------- |
| `backend/`  | NestJS 12 · TypeScript · Prisma 7 · PostgreSQL 17 · Socket.IO  |
| `frontend/` | React 19 · TypeScript · Vite · Tailwind CSS 4 · React Query    |
| raíz        | `docker-compose.yml` (BD de desarrollo) y `docker-compose.prod.yml` (todo) |

**Contenido**

1. [Requisitos](#1-requisitos)
2. [Instalación paso a paso (primera vez)](#2-instalación-paso-a-paso-primera-vez)
3. [Arrancar el proyecto otro día](#3-arrancar-el-proyecto-otro-día)
4. [Variables de entorno](#4-variables-de-entorno)
5. [Cuentas, administrador y personalización](#5-cuentas-administrador-y-personalización)
6. [Estructura del proyecto](#6-estructura-del-proyecto)
7. [Cambios en la base de datos](#7-cambios-en-la-base-de-datos)
8. [Tests](#8-tests)
9. [Problemas comunes](#9-problemas-comunes)
10. [Producción](#10-producción)
11. [Servicios externos opcionales](#11-servicios-externos-opcionales)
12. [Funcionalidades](#12-funcionalidades)
13. [API y tiempo real](#13-api-y-tiempo-real)
14. [Límites conocidos y roadmap](#14-límites-conocidos-y-roadmap)

---

## 1. Requisitos

Instala esto antes de empezar:

| Programa | Versión | Para qué | Cómo comprobarlo |
| --- | --- | --- | --- |
| [Git](https://git-scm.com/downloads) | cualquiera reciente | Descargar el código | `git --version` |
| [Node.js](https://nodejs.org/) | **22 o superior** (trae npm 10) | Backend y frontend | `node -v` |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | cualquiera reciente | Base de datos PostgreSQL | `docker --version` |

> **Docker Desktop tiene que estar abierto** cada vez que trabajes en el proyecto. Si está cerrado, la base de datos no existe y el backend falla (ver [Problemas comunes](#9-problemas-comunes)). Para no olvidarlo: Docker Desktop → *Settings* → *General* → activa *Start Docker Desktop when you sign in to your computer*.

No necesitas instalar PostgreSQL: corre dentro de Docker.

---

## 2. Instalación paso a paso (primera vez)

Vas a usar **dos terminales**: una para el backend y otra para el frontend. Los comandos funcionan igual en PowerShell, Git Bash o la terminal de VS Code, salvo donde se indica.

### Paso 1. Descargar el código

```bash
git clone https://github.com/SarhenRamirez/GuildGamer.git
cd GuildGamer
```

### Paso 2. Levantar la base de datos

Con Docker Desktop abierto, desde la carpeta raíz del proyecto:

```bash
docker compose up -d --wait
```

Crea un contenedor llamado `gamezone-db` con PostgreSQL en el puerto **5433** (no el 5432, para no chocar si ya tienes un PostgreSQL instalado). Cuando termina, `docker ps` debe mostrar `gamezone-db ... (healthy)`.

Los datos se guardan en un volumen de Docker: no se pierden al apagar el computador.

### Paso 3. Configurar el backend

```bash
cd backend
```

Copia el archivo de ejemplo de variables de entorno:

```bash
# PowerShell
Copy-Item .env.example .env

# Git Bash / macOS / Linux
cp .env.example .env
```

Abre `backend/.env` y cambia `JWT_SECRET` por cualquier texto largo y difícil de adivinar (es la clave con la que se firman las sesiones de usuario). Lo demás ya viene listo para desarrollo. Ver [Variables de entorno](#4-variables-de-entorno).

### Paso 4. Instalar dependencias y preparar la base de datos

Todavía dentro de `backend/`:

```bash
npm install                 # descarga las dependencias (tarda 1-3 minutos)
npx prisma generate         # genera el cliente de base de datos en src/generated/
npx prisma migrate deploy   # crea todas las tablas
npx prisma db seed          # carga el catálogo inicial de juegos
```

Qué debes ver:

- `prisma generate` → `✔ Generated Prisma Client`
- `migrate deploy` → `All migrations have been successfully applied.`
- `db seed` → `The seed command has been executed.`

> `npm install` no genera el cliente de Prisma por sí solo: si te saltas `npx prisma generate`, el backend no compila.

### Paso 5. Arrancar el backend

```bash
npm run start:dev
```

Espera hasta ver `Found 0 errors. Watching for file changes.` y comprueba en el navegador:

- http://localhost:3000/health → `{"status":"ok","database":"up"}`
- http://localhost:3000/docs → documentación de la API (Swagger)

Deja esta terminal abierta. El modo `start:dev` recarga solo cuando cambias código en `src/`.

### Paso 6. Arrancar el frontend

En **otra terminal**, desde la raíz del proyecto:

```bash
cd frontend
npm install
npm run dev
```

Abre **http://localhost:5173**. Vite reenvía `/api`, `/socket.io` y `/uploads` al backend del puerto 3000, así que no hay que configurar nada más.

### Paso 7. Crear tu cuenta

En http://localhost:5173 haz clic en **Regístrate**. Después del registro la app te lleva a completar el perfil gamer. Para tener el panel de administración, mira [Hacerte administrador](#hacerte-administrador).

---

## 3. Arrancar el proyecto otro día

Una vez instalado, el día a día es:

1. Abre **Docker Desktop** y espera a que diga que está corriendo.
2. Desde la raíz: `docker compose up -d --wait` (si el contenedor ya está arriba, no hace nada).
3. Terminal 1: `cd backend` y `npm run start:dev`.
4. Terminal 2: `cd frontend` y `npm run dev`.
5. Abre http://localhost:5173.

Si hiciste `git pull` y llegaron cambios, antes del paso 3 ejecuta en `backend/`:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
```

y `npm install` en `frontend/`.

---

## 4. Variables de entorno

Todas van en `backend/.env` (desarrollo) o en `.env.prod` (producción). El archivo `.env` **nunca se sube a GitHub**: cada persona tiene el suyo.

| Variable | Valor por defecto | Qué hace |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://gamezone:gamezone@localhost:5433/gamezone?schema=public` | Conexión a la BD de Docker. No la cambies salvo que uses otra base de datos |
| `PORT` | `3000` | Puerto del backend. Si lo cambias, arranca el frontend con `VITE_BACKEND_URL=http://localhost:<puerto>` |
| `JWT_SECRET` | `cambia-esto-...` | **Cámbialo.** Clave para firmar los tokens de sesión |
| `JWT_EXPIRES_IN` | `7d` | Cuánto dura la sesión iniciada |
| `FRONTEND_URL` | `http://localhost:5173` | Origen permitido para CORS y Socket.IO |
| `PUBLIC_URL` | `http://localhost:3000` | URL con la que se construyen los enlaces de archivos subidos |
| `UPLOAD_DIR` | `uploads` | Carpeta donde se guardan avatares e imágenes subidas |
| `GOOGLE_CLIENT_ID` | vacío | Login con Google (opcional) |
| `PAYMENTS_PROVIDER` | `mock` | `mock` = pasarela simulada; `stripe` = pagos reales |
| `PREMIUM_PRICE_CENTS`, `PREMIUM_CURRENCY` | `499`, `USD` | Precio mostrado de Premium |
| `STRIPE_*` | vacío | Solo si `PAYMENTS_PROVIDER=stripe` |
| `TURN_*` | vacío | Servidor TURN para la voz en redes muy restrictivas (opcional) |
| `RAWG_API_KEY` | vacío | Portadas reales de los juegos (opcional, ver [abajo](#portadas-reales-de-los-juegos-rawg)) |

> Los valores van **entre comillas dobles, abiertas y cerradas**: `RAWG_API_KEY="abc123"`. Si falta la comilla final, la variable se lee mal.
>
> El backend lee `.env` **solo al arrancar**: después de cambiarlo, detén el backend (`Ctrl + C`) y vuelve a ejecutar `npm run start:dev`.

---

## 5. Cuentas, administrador y personalización

### Hacerte administrador

Regístrate normalmente y luego, con Docker corriendo, ejecuta (cambiando el correo):

```bash
docker exec gamezone-db psql -U gamezone -c "update users set role='ADMIN' where email='tu@email.com'"
```

Cierra sesión y vuelve a entrar: aparece **Administración** en el menú lateral (estadísticas, reportes, usuarios y catálogo de juegos).

### Usuario de prueba

No viene ningún usuario creado: cada base de datos empieza vacía. Para pruebas, registra uno desde la app (por ejemplo `prueba@guildgamer.test`).

### Colores de la interfaz

Cada usuario elige su color en **Editar perfil → Personalización**: verde (estilo Xbox), azul (PlayStation), rojo (Nintendo), morado o naranja. El color se guarda en su cuenta y cambia botones, acentos y el tono de las imágenes de fondo.

### Avatares gamer

En **Editar perfil**, debajo de *Cambiar avatar*, hay 12 avatares ilustrados para elegir sin subir una foto. Están en `frontend/public/avatars/`.

### Portadas reales de los juegos (RAWG)

Sin configurar nada, cada juego muestra una ilustración generada por la app. Para usar las portadas oficiales:

1. Crea una cuenta en https://rawg.io y entra a https://rawg.io/apidocs → **Get API Key** (es gratis). Si te pide importar tu biblioteca de juegos, dale a **Saltar**.
2. Pega la clave en `backend/.env`: `RAWG_API_KEY="tu-clave"`.
3. Reinicia el backend. Al arrancar trae las portadas que falten.

Después, en **Administración → Juegos** tienes *Traer las que faltan* y *Actualizar todas*, y cada juego nuevo que agregues trae su portada automáticamente. También puedes pegar la URL de una portada a mano en cada juego.

### Juegos destacados

En el inicio, *Juegos populares* muestra primero Valorant, Minecraft, Fortnite, League of Legends, Call of Duty: Warzone y GTA V, y luego el resto según sus sesiones abiertas. La lista está en `FEATURED`, en `backend/src/games/games.service.ts`.

---

## 6. Estructura del proyecto

```
GuildGamer/
├── docker-compose.yml          # PostgreSQL de desarrollo (puerto 5433)
├── docker-compose.prod.yml     # Producción: BD + backend + nginx con el frontend
├── .env.prod.example           # Plantilla de variables para producción
├── .github/workflows/ci.yml    # CI: lint, tests y build en cada push
├── backend/
│   ├── .env.example            # Plantilla de variables de desarrollo
│   ├── prisma/
│   │   ├── schema.prisma       # Modelo de datos (tablas y relaciones)
│   │   ├── migrations/         # Historial de cambios de la BD (no editar las ya aplicadas)
│   │   └── seed.ts             # Catálogo inicial de juegos
│   ├── src/
│   │   ├── main.ts             # Punto de entrada
│   │   ├── app.module.ts       # Registro de todos los módulos
│   │   ├── auth/               # Registro, login, JWT, Google, roles
│   │   ├── users/              # Perfil, búsqueda, jugadores en línea
│   │   ├── games/              # Catálogo, juegos populares, portadas RAWG
│   │   ├── sessions/           # Sesiones, miembros, recordatorios automáticos
│   │   ├── chat/               # Chat de sesión y mensajes privados (Socket.IO)
│   │   ├── voice/              # Señalización WebRTC del chat de voz
│   │   ├── notifications/      # Notificaciones y presencia en línea
│   │   ├── friends/  posts/  reviews/  reports/
│   │   ├── premium/  payments/ # Suscripción y pasarela (simulada o Stripe)
│   │   ├── gamebot/            # Asistente de ayuda
│   │   ├── admin/  files/  common/  prisma/
│   │   └── generated/          # Cliente de Prisma (se genera, no está en Git)
│   └── test/                   # Tests e2e contra la BD real
└── frontend/
    ├── public/                 # favicon, avatars/, backgrounds/
    ├── vite.config.ts          # Proxy hacia el backend
    └── src/
        ├── main.tsx  App.tsx   # Arranque y rutas
        ├── index.css           # Tailwind, temas de color y fondos
        ├── pages/              # Una pantalla por archivo
        ├── components/         # Layout, tarjetas, UI reutilizable
        ├── auth/  realtime/  voice/
        └── lib/                # API, tipos, formatos, temas, avatares
```

---

## 7. Cambios en la base de datos

El modelo está en `backend/prisma/schema.prisma`. Para cambiarlo:

1. Edita `schema.prisma`.
2. En `backend/`, crea la migración con un nombre descriptivo:
   ```bash
   npx prisma migrate dev --name agrega_campo_x
   ```
   Esto crea una carpeta en `prisma/migrations/`, la aplica y regenera el cliente.
3. Sube la carpeta de la migración junto con tu cambio.

Reglas:

- **Nunca edites una migración que ya se aplicó**: Prisma compara su checksum y se niega a continuar. Si algo quedó mal, crea otra migración que lo corrija.
- Para ver la BD con una interfaz gráfica: `npx prisma studio`.
- Para empezar de cero (**borra todos los datos**): `npx prisma migrate reset` y luego `npx prisma db seed` para volver a cargar los juegos.

---

## 8. Tests

En `backend/`, con la base de datos corriendo:

```bash
npm test             # unitarios
npm run test:e2e     # más de 100 tests e2e contra la BD real
npm run lint
```

Los tests e2e levantan la app completa, usan la misma BD de desarrollo y crean usuarios con correos `@test.gz`, que borran al terminar. No tocan tus usuarios.

En el frontend, `npm run build` comprueba los tipos y compila.

---

## 9. Problemas comunes

**El backend muestra `ECONNREFUSED` o `Can't reach database server at localhost:5433`**
Docker Desktop está cerrado o el contenedor no está corriendo. Abre Docker Desktop, espera a que arranque y ejecuta `docker compose up -d --wait` en la raíz. El backend se reconecta solo.

**`docker: error during connect ... dockerDesktopLinuxEngine`**
Mismo caso: Docker Desktop no está abierto.

**El backend no compila: `Cannot find module '../generated/prisma/...'`**
Falta generar el cliente: `npx prisma generate` en `backend/`. Pasa después de clonar o de borrar `node_modules`.

**`npm install` falla con `ERESOLVE` o `edgesOut`**
Asegúrate de ejecutarlo dentro de `backend/`, donde está el `.npmrc` que activa `legacy-peer-deps`. Si persiste: borra `node_modules` y `package-lock.json` y vuelve a ejecutar `npm install`.

**`The table ... does not exist` o errores de columnas**
Faltan migraciones: `npx prisma migrate deploy` en `backend/`.

**`Port 5433 is already allocated` al hacer `docker compose up`**
Otro programa usa el puerto 5433. Cámbialo en `docker-compose.yml` (por ejemplo `'5434:5432'`) y en `DATABASE_URL` de `backend/.env`.

**`EADDRINUSE: address already in use :::3000` (o `5173`)**
Ya hay otro backend o frontend corriendo, quizá en otra terminal. Ciérralo, o cambia el puerto (ver `PORT` en [Variables de entorno](#4-variables-de-entorno)).

**El frontend carga pero todo falla con errores 500/502 o "Failed to fetch"**
El backend no está corriendo o se cayó. Revisa la terminal del backend y http://localhost:3000/health.

**Cambié `backend/.env` y no pasa nada**
El backend lee `.env` solo al arrancar: `Ctrl + C` y `npm run start:dev`. Revisa también que cada valor tenga sus dos comillas.

**Las portadas de RAWG no aparecen**
Revisa que `RAWG_API_KEY` tenga comillas de apertura y de cierre y que reiniciaste el backend. En Administración → Juegos, *Traer las que faltan* muestra el error si la clave no sirve.

**El chat de voz no pide el micrófono**
Los navegadores solo permiten el micrófono en `localhost` o en sitios con `https`. En producción, pon el sitio detrás de HTTPS.

**Quiero borrar todo y empezar de cero**
En `backend/`: `npx prisma migrate reset` (borra los datos y vuelve a aplicar las migraciones) y después `npx prisma db seed` (vuelve a cargar los juegos). Para borrar incluso el volumen de Docker: `docker compose down -v` en la raíz, y repite el [paso 2](#paso-2-levantar-la-base-de-datos) y el [paso 4](#paso-4-instalar-dependencias-y-preparar-la-base-de-datos).

---

## 10. Producción

```bash
# PowerShell: Copy-Item .env.prod.example .env.prod
cp .env.prod.example .env.prod      # rellena POSTGRES_PASSWORD, JWT_SECRET y PUBLIC_URL
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Levanta PostgreSQL, el backend (aplica migraciones y carga el catálogo al arrancar) y nginx con el frontend en `http://localhost:8080` (puerto configurable con `APP_PORT`). Todo va por el mismo origen: nginx reenvía `/api`, `/socket.io` y `/uploads` al backend.

Sirve en cualquier servidor con Docker (VPS, Railway, Render, Fly.io…). Delante conviene un proxy con HTTPS, que además es obligatorio para que el navegador permita usar el micrófono.

CI: `.github/workflows/ci.yml` compila, pasa el linter y ejecuta todos los tests del backend contra un PostgreSQL real, y compila el frontend.

---

## 11. Servicios externos opcionales

Todo funciona sin configurarlos.

| Qué | Variables (en `backend/.env` o `.env.prod`) | Sin configurar |
| --- | --- | --- |
| Login con Google | `GOOGLE_CLIENT_ID` (ID de cliente OAuth, tipo *Aplicación web*, con tu dominio en *Orígenes autorizados*) | El botón de Google no aparece |
| Pagos reales | `PAYMENTS_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` (precio recurrente), `STRIPE_WEBHOOK_SECRET` (webhook a `/api/payments/webhook`) | Pasarela simulada: eliges "pago correcto" o "rechazado" |
| Voz tras NAT estricto | `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` | Solo STUN público: funciona en la mayoría de redes |
| Portadas reales de juegos | `RAWG_API_KEY` (gratis en rawg.io/apidocs) | Portadas ilustradas generadas por la app |

Los archivos subidos se guardan en disco (`UPLOAD_DIR`, volumen `uploads` en Docker). Para pasarlos a un almacenamiento en la nube (S3, R2…) basta con sustituir `backend/src/files/storage.service.ts`.

---

## 12. Funcionalidades

- **Cuentas**: email y contraseña, o Google. Perfil gamer con avatar (propio o de la galería gamer), bio, nivel, idiomas, disponibilidad, preferencia de comunicación, y juegos con plataforma, rango, rol e ID gamer.
- **Inicio**: juegos populares con portadas, sesiones disponibles con botón *Unirse*, jugadores en línea (y a qué están jugando), actividad reciente.
- **Personalización**: cinco colores de interfaz por usuario; el fondo cambia de tono con el color elegido.
- **Sesiones**: crear, buscar con filtros (juego, plataforma, nivel, idioma, horario, micro), ingreso automático o con aprobación, invitar amigos, expulsar y cancelar. Botón **Jugar ahora** con el código de sala, visible solo para los miembros. Recomendaciones según tus juegos.
- **Chat de texto** por sesión y **mensajes privados** entre amigos, en tiempo real (Socket.IO) y con límite anti-spam.
- **Chat de voz** estilo Discord con WebRTC:
  - un canal por sesión y salas permanentes para amigos;
  - silenciar, ensordecerse, presionar para hablar con la tecla V e indicador de quién habla.
- **Notificaciones** en la app y en vivo. **Recordatorio** automático una hora antes de cada sesión, y cambio de estado automático: en curso y terminada.
- **Comunidad**: amigos, bloqueo, publicaciones (general, clip, logro, debate) con imágenes o clips, likes y comentarios.
- **Reputación**: estrellas y etiquetas (Buen compañero, Puntual…) tras cada sesión terminada.
- **Reportes y moderación**: reportar usuarios, sesiones, mensajes o publicaciones. El panel de admin incluye estadísticas, usuarios (roles y baneos), cola de reportes y catálogo de juegos con portadas.
- **Premium**: perfil destacado en las búsquedas, estadísticas avanzadas, portada y color de perfil, y torneos de hasta 100 jugadores.
- **GameBot**: asistente de ayuda sobre GuildGamer y conceptos de videojuegos.

---

## 13. API y tiempo real

La referencia completa de la API está en **http://localhost:3000/docs** (Swagger), con cada endpoint, sus datos de entrada y los eventos de Socket.IO. Desde el frontend, las rutas van con el prefijo `/api` (por ejemplo `/api/health`).

Resumen de los canales en tiempo real:

| Namespace | Envías | Recibes |
| --- | --- | --- |
| `/chat` | `session:join`, `session:leave`, `message:send`, `typing`, `dm:send` | `message:new`, `typing`, `member:joined`, `member:left`, `session:removed`, `session:cancelled`, `session:status`, `dm:new` |
| `/notifications` | — | `notification:new` |
| `/voice` | `voice:join` (responde con los participantes), `voice:signal`, `voice:state`, `voice:leave` | `voice:peer-joined`, `voice:peer-left`, `voice:signal`, `voice:state`, `voice:closed` |

Todos se autentican con `io(url + '/<namespace>', { auth: { token } })`.

---

## 14. Límites conocidos y roadmap

**Límites**

- **Voz**: es una malla P2P, con un máximo de 8 personas por canal. Para canales más grandes haría falta un SFU (por ejemplo mediasoup).
- **Varias instancias del backend**: las salas de voz, la presencia en línea y el límite anti-spam viven en memoria. Para escalar a varias instancias haría falta el adaptador de Redis de Socket.IO.

**Roadmap**

- [x] **Fase 1**: diseño, requisitos y base de datos
- [x] **Fase 2**: auth (JWT + Google), usuarios y perfil gamer
- [x] **Fase 3**: catálogo de juegos y sesiones
- [x] **Fase 4**: unirse a sesiones + chat de texto
- [x] **Fase 5**: notificaciones + cron de recordatorios
- [x] **Fase 6**: panel de admin + Swagger
- [x] **Fase 7**: Docker, CI y pruebas del flujo completo
- [x] **Fase 8**: amigos, mensajes privados, publicaciones, reputación, reportes, Premium, GameBot, torneos
- [ ] **Fase 9**:
  - [x] chat de voz WebRTC
  - [x] recomendaciones de sesiones
  - [x] portadas oficiales de juegos (RAWG), temas de color y avatares gamer
  - [ ] geolocalización, app nativa para celular y matchmaking avanzado
