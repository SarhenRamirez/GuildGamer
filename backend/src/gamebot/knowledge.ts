export interface KnowledgeEntry {
  id: string;
  question: string;
  keywords: string[];
  answer: string;
}

export const KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: 'crear-sesion',
    question: '¿Cómo creo una sesión?',
    keywords: ['crear sesion', 'crear una sesion', 'nueva sesion', 'crear partida', 'organizar', 'publicar sesion'],
    answer:
      'Ve a "Sesiones" y haz clic en "Crear sesión". Elige el juego y la plataforma, cuántos jugadores necesitas, la hora, el nivel, el idioma y si hace falta micrófono. Decide también si aceptas a la gente a mano o si entran automáticamente. Puedes agregar el código de sala o enlace de invitación: solo lo verán los miembros aceptados.',
  },
  {
    id: 'unirse',
    question: '¿Cómo me uno a una sesión?',
    keywords: ['unirme', 'unirse', 'uno sesion', 'entrar sesion', 'apuntarme', 'unir a una sesion', 'solicitud'],
    answer:
      'Abre la sesión y haz clic en "Unirme". Si el creador eligió ingreso automático entras al momento; si no, tu solicitud queda pendiente y te avisaremos cuando la acepte o la rechace. Si un amigo creador te invita, entras directamente.',
  },
  {
    id: 'encontrar-jugadores',
    question: '¿Cómo encuentro jugadores?',
    keywords: ['encontrar jugadores', 'encuentro jugadores', 'encuentro gente', 'buscar jugadores', 'buscar gente', 'con quien jugar', 'companeros', 'encontrar gente', 'jugadores'],
    answer:
      'En "Jugadores" puedes filtrar por juego, plataforma, nivel, idioma, disponibilidad y si prefieren texto o voz. Por ejemplo: Minecraft + PC + español + disponible. También te recomendamos sesiones según los juegos de tu perfil en la página de inicio.',
  },
  {
    id: 'jugar-ahora',
    question: '¿Cómo entro al juego desde GuildGamer?',
    keywords: ['jugar ahora', 'codigo de sala', 'entrar al juego', 'enlace de invitacion', 'como juego', 'abrir juego'],
    answer:
      'GuildGamer no ejecuta los juegos: organiza al grupo. Cuando estés dentro de una sesión verás el botón "Jugar ahora" con los datos para entrar (código de sala, enlace o ID gamer del creador). Luego abren el juego en su plataforma.',
  },
  {
    id: 'recordatorios',
    question: '¿Me avisan antes de la sesión?',
    keywords: ['recordatorio', 'aviso', 'avisar', 'notificacion', 'notificaciones', 'alerta'],
    answer:
      'Sí. Una hora antes de que empiece recibirás "Tu sesión comienza en…". También te avisamos si te aceptan, si cambia la hora o si se cancela. Las ves en la campana de notificaciones.',
  },
  {
    id: 'voz',
    question: '¿Cómo funciona el chat de voz?',
    keywords: ['chat de voz', 'voz', 'microfono', 'hablar', 'discord', 'push to talk', 'mute', 'silenciar'],
    answer:
      'Cada sesión tiene su canal de voz: entra con un clic desde la sesión. Puedes silenciar tu micrófono, ensordecerte (dejar de oír a los demás) y ves quién está hablando. Con tus amigos puedes crear salas de voz permanentes. Tu navegador te pedirá permiso para usar el micrófono.',
  },
  {
    id: 'chat-texto',
    question: '¿Cómo hablo con mi grupo?',
    keywords: ['chat', 'mensaje', 'escribir', 'hablar con el grupo', 'mensajes privados', 'mensaje privado'],
    answer:
      'Al entrar en una sesión tienes su chat de texto en tiempo real. Para hablar en privado con un amigo, ve a "Mensajes". Solo puedes escribir en privado a tus amigos.',
  },
  {
    id: 'amigos',
    question: '¿Cómo agrego amigos?',
    keywords: ['amigo', 'amigos', 'agregar', 'anadir amigo', 'solicitud de amistad', 'bloquear'],
    answer:
      'Entra al perfil de un jugador y haz clic en "Agregar amigo". Cuando acepte podrán chatear en privado, invitarse a sesiones y usar salas de voz. Si alguien te molesta puedes bloquearlo desde su perfil.',
  },
  {
    id: 'reputacion',
    question: '¿Cómo funciona la reputación?',
    keywords: ['reputacion', 'valorar', 'valoracion', 'estrellas', 'etiquetas', 'resena', 'puntuacion'],
    answer:
      'Al terminar una sesión puedes valorar a cada compañero con 1–5 estrellas y etiquetas como "Buen compañero", "Buena comunicación", "Respetuoso", "Buen jugador" o "Puntual". Tienes 14 días. La media y las etiquetas aparecen en su perfil.',
  },
  {
    id: 'reportar',
    question: '¿Cómo reporto a alguien?',
    keywords: ['reportar', 'reporte', 'denunciar', 'acoso', 'spam', 'toxico', 'insulto', 'trampa'],
    answer:
      'Usa el botón "Reportar" en el perfil, la sesión, el mensaje o la publicación. Elige el motivo (spam, acoso, cuenta falsa, contenido inapropiado…) y agrega detalles. El equipo de moderación lo revisa y te avisamos cuando se resuelva.',
  },
  {
    id: 'premium',
    question: '¿Qué incluye Premium?',
    keywords: ['premium', 'suscripcion', 'pagar', 'precio', 'cuanto cuesta', 'ventajas', 'destacado'],
    answer:
      'Premium incluye: perfil destacado en las búsquedas, estadísticas avanzadas (horas por juego, compañeros habituales), personalización del perfil (banner y color) y crear torneos o eventos de hasta 100 jugadores. Crear y unirse a sesiones, el chat y la voz siguen siendo gratis.',
  },
  {
    id: 'torneos',
    question: '¿Cómo creo un torneo?',
    keywords: ['torneo', 'evento', 'competicion', 'campeonato'],
    answer:
      'Los torneos son sesiones especiales de hasta 100 jugadores y requieren Premium. Al crear una sesión elige el tipo "Torneo".',
  },
  {
    id: 'perfil',
    question: '¿Cómo edito mi perfil?',
    keywords: ['perfil', 'avatar', 'foto', 'biografia', 'editar perfil', 'disponibilidad', 'idiomas'],
    answer:
      'En "Mi perfil" puedes cambiar tu avatar, biografía, nivel, idiomas, disponibilidad (disponible, ausente, no disponible) y preferencia de comunicación. Agrega también tus juegos y plataformas con tu ID gamer para que te encuentren.',
  },
  {
    id: 'cancelar-sesion',
    question: '¿Cómo cancelo o salgo de una sesión?',
    keywords: ['cancelar', 'salir de la sesion', 'abandonar', 'borrar sesion', 'eliminar sesion'],
    answer:
      'Si eres miembro, haz clic en "Salir" en la sesión. Si eres el creador no puedes salir, pero sí cancelarla: todos los miembros recibirán un aviso.',
  },
  {
    id: 'crossplay',
    question: '¿Qué significa crossplay?',
    keywords: ['crossplay', 'cross play', 'multiplataforma', 'juego cruzado'],
    answer:
      'Crossplay (juego cruzado) significa que jugadores de distintas plataformas —por ejemplo PC, PlayStation y Xbox— pueden jugar juntos en la misma partida. En GuildGamer los juegos con crossplay llevan esa etiqueta.',
  },
  {
    id: 'ping',
    question: '¿Qué es el ping o el lag?',
    keywords: ['ping', 'lag', 'latencia', 'retraso', 'ms'],
    answer:
      'El ping es el tiempo (en milisegundos) que tarda tu conexión en ir al servidor y volver. Si es alto notas lag: retrasos o saltos. Para competitivo, por debajo de 50 ms es ideal; conectarte por cable y a un servidor cercano ayuda.',
  },
  {
    id: 'ranked',
    question: '¿Qué es una partida clasificatoria?',
    keywords: ['ranked', 'clasificatoria', 'competitiva', 'elo', 'mmr', 'rango', 'liga'],
    answer:
      'Las partidas clasificatorias (ranked) cuentan para tu rango. El juego calcula tu nivel (MMR o Elo) según ganas o pierdes y te empareja con gente parecida. Las partidas normales o casual no afectan al rango.',
  },
  {
    id: 'kd',
    question: '¿Qué es el K/D?',
    keywords: ['k/d', 'kd', 'kda', 'asesinatos', 'muertes', 'ratio'],
    answer:
      'K/D es la relación entre bajas (kills) y muertes (deaths). Un K/D de 2 significa que eliminas el doble de veces de las que te eliminan. KDA suma también las asistencias.',
  },
  {
    id: 'generos',
    question: '¿Qué es un battle royale o un MOBA?',
    keywords: ['battle royale', 'moba', 'fps', 'shooter', 'mmo', 'rpg', 'genero', 'sandbox'],
    answer:
      'Battle royale: muchos jugadores en un mapa que se va cerrando, gana el último en pie (Fortnite, Warzone). MOBA: dos equipos defienden su base con héroes (League of Legends). FPS: disparos en primera persona (Valorant, CS2). Sandbox: mundo abierto para construir y explorar (Minecraft).',
  },
  {
    id: 'jerga',
    question: '¿Qué significa GG, AFK o noob?',
    keywords: ['gg', 'afk', 'noob', 'nerf', 'buff', 'meta', 'smurf', 'carry', 'jerga', 'significa'],
    answer:
      'GG ("good game"): buena partida, se dice al terminar. AFK ("away from keyboard"): ausente. Noob: novato. Buff/nerf: cuando una actualización mejora o empeora algo. Meta: la estrategia más eficaz del momento. Smurf: jugador experto en una cuenta nueva. Carry: quien lleva al equipo a la victoria.',
  },
];

export const GREETING_KEYWORDS = ['hola', 'buenas', 'hey', 'saludos', 'que tal', 'ayuda', 'help'];
