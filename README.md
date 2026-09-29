# GuildGamer

Plataforma social para encontrar jugadores, crear sesiones y comunicarse por texto y voz antes de entrar a jugar. GuildGamer no ejecuta los juegos: organiza al grupo y lo conecta con su juego externo.

| Carpeta     | Stack                                                          |
| ----------- | -------------------------------------------------------------- |
| `backend/`  | NestJS 12 · TypeScript · Prisma 7 · PostgreSQL · Socket.IO     |
| `frontend/` | React 19 · TypeScript · Vite · Tailwind CSS 4 · React Query    |
| raíz        | `docker-compose.yml` (BD de desarrollo) y `docker-compose.prod.yml` (todo) |

## Puesta en marcha (desarrollo)

Requisitos: Node 22+ y Docker Desktop.

```bash
# 1. Base de datos (puerto 5433 para no chocar con un PostgreSQL local en 5432)
docker compose up -d

# 2. Backend → http://localhost:3000  ·  documentación de la API en http://localhost:3000/docs
cd backend
cp .env.example .env         # y cambia JWT_SECRET
npm install                  # .npmrc activa legacy-peer-deps (bug de npm 10)
npx prisma migrate dev       # aplica migraciones y genera el cliente
npx prisma db seed           # catálogo inicial de juegos
npm run start:dev

# 3. Frontend → http://localhost:5173 (el proxy de Vite reenvía /api, /socket.io y /uploads al backend)
cd ../frontend
npm install
npm run dev
```

Para hacerte admin: `docker exec gamezone-db psql -U gamezone -c "update users set role='ADMIN' where email='tu@email.com'"`.

## Producción

```bash
cp .env.prod.example .env.prod      # rellena POSTGRES_PASSWORD, JWT_SECRET y PUBLIC_URL
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Levanta PostgreSQL, el backend (aplica migraciones y el catálogo al arrancar) y nginx con el frontend en `http://localhost:8080`. Todo va por el mismo origen: nginx reenvía `/api`, `/socket.io` y `/uploads` al backend. Sirve en cualquier servidor con Docker (VPS, Railway, Render, Fly.io…); delante conviene un proxy con HTTPS, que además es obligatorio para que el navegador permita usar el micrófono.

CI: `.github/workflows/ci.yml` compila, pasa el linter y ejecuta todos los tests del backend contra un PostgreSQL real, y compila el frontend.

## Funcionalidades

- **Cuentas**: email y contraseña, o Google. Perfil gamer con avatar, bio, nivel, idiomas, disponibilidad, preferencia de comunicación, y juegos con plataforma e ID gamer.
- **Sesiones**: crear, buscar con filtros (juego, plataforma, nivel, idioma, horario, micro), ingreso automático o con aprobación, invitar amigos, expulsar y cancelar. Botón **Jugar ahora** con el código de sala, visible solo para los miembros. Recomendaciones según tus juegos.
- **Chat de texto** por sesión y **mensajes privados** entre amigos, en tiempo real (Socket.IO) y con límite anti-spam.
- **Chat de voz** estilo Discord con WebRTC:
  - un canal por sesión y salas permanentes para amigos;
  - silenciar, ensordecerse, presionar para hablar con la tecla V e indicador de quién habla.
- **Notificaciones** en la app y en vivo. **Recordatorio** automático una hora antes de cada sesión, y cambio de estado automático: en curso y terminada.
- **Comunidad**: amigos, bloqueo, publicaciones con imágenes o clips, likes y comentarios.
- **Reputación**: estrellas y etiquetas (Buen compañero, Puntual…) tras cada sesión terminada.
- **Reportes y moderación**: reportar usuarios, sesiones, mensajes o publicaciones. El panel de admin incluye estadísticas, usuarios (roles y baneos), cola de reportes y catálogo de juegos.
- **Premium**: perfil destacado en las búsquedas, estadísticas avanzadas, portada y color de perfil, y torneos de hasta 100 jugadores.
- **GameBot**: asistente de ayuda sobre GuildGamer y conceptos de videojuegos.

## Configuración opcional (servicios externos)

| Qué | Variables (en `backend/.env` o `.env.prod`) | Sin configurar |
| --- | --- | --- |
| Login con Google | `GOOGLE_CLIENT_ID` (ID de cliente OAuth, tipo *Aplicación web*, con tu dominio en *Orígenes autorizados*) | El botón de Google no aparece |
| Pagos reales | `PAYMENTS_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` (precio recurrente), `STRIPE_WEBHOOK_SECRET` (webhook a `/api/payments/webhook`) | Pasarela simulada: eliges "pago correcto" o "rechazado" |
| Voz tras NAT estricto | `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` | Solo STUN público: funciona en la mayoría de redes |

Los archivos subidos se guardan en disco (`UPLOAD_DIR`, volumen `uploads` en Docker). Para pasarlos a un almacenamiento en la nube (S3, R2…) basta con sustituir `backend/src/files/storage.service.ts`.

## API y tiempo real

La referencia completa de la API está en **`/docs`** (Swagger), con cada endpoint, su DTO y los eventos de Socket.IO. Resumen de los canales en tiempo real:

| Namespace | Envías | Recibes |
| --- | --- | --- |
| `/chat` | `session:join`, `session:leave`, `message:send`, `typing`, `dm:send` | `message:new`, `typing`, `member:joined`, `member:left`, `session:removed`, `session:cancelled`, `session:status`, `dm:new` |
| `/notifications` | — | `notification:new` |
| `/voice` | `voice:join` (responde con los participantes), `voice:signal`, `voice:state`, `voice:leave` | `voice:peer-joined`, `voice:peer-left`, `voice:signal`, `voice:state`, `voice:closed` |

Todos se autentican con `io(url + '/<namespace>', { auth: { token } })`.

## Tests

```bash
cd backend
npm test             # unitarios
npm run test:e2e     # 88 tests e2e contra la BD real (necesita docker compose up -d)
npm run lint
```

## Límites conocidos

- **Voz**: es una malla P2P, con un máximo de 8 personas por canal. Para canales más grandes haría falta un SFU (por ejemplo mediasoup).
- **Varias instancias del backend**: las salas de voz y el límite anti-spam viven en memoria. Para escalar a varias instancias haría falta el adaptador de Redis de Socket.IO.

## Roadmap

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
  - [ ] geolocalización, integraciones con APIs oficiales de juegos, app nativa para celular y matchmaking avanzado
