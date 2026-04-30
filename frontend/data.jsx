/* global window */
// Seed data — agents + conversations
const SEED_AGENTS = [
  {
    id: "doggo",
    name: "DogGo",
    handle: "doggo",
    emoji: "🐕",
    status: "idle",
    model: "claude-sonnet-4.5",
    tags: ["pets", "research"],
    tokens: 18420,
    cost: 0.42,
    lastActive: Date.now() - 1000 * 60 * 12,
    unread: 0,
    messages: [
      { id: "d1", role: "agent", text: "Hola, soy DogGo. Estoy listo para ayudarte con todo lo relacionado con perros, razas y cuidados.", t: dayAgo(1, 9, 2) },
      { id: "d2", role: "user", text: "hola", t: dayAgo(0, 21, 1) },
      { id: "d3", role: "agent", text: "¡Hola! Aquí al quite. ¿Qué necesitas?", t: dayAgo(0, 21, 2) },
      { id: "d4", role: "user", text: "qué raza es buena para apartamentos pequeños?", t: dayAgo(0, 21, 3) },
      {
        id: "d5", role: "tool",
        tool: "search_breeds",
        args: 'size: "small", energy: "low", apartment: true',
        output: "→ 14 razas encontradas\nbichón frisé · cavalier · shih tzu · …",
        t: dayAgo(0, 21, 3)
      },
      { id: "d6", role: "agent", text: "Para apartamentos te recomendaría el **Bichón Frisé** o el **Cavalier King Charles** — ambos son tranquilos, sociables, y se adaptan bien a espacios reducidos. ¿Quieres que profundice en alguno?", t: dayAgo(0, 21, 4) },
    ],
    toolsAvailable: [
      { name: "search_breeds", desc: "Busca razas por filtros", lastUsed: "12m" },
      { name: "vet_locator", desc: "Encuentra veterinarios cercanos", lastUsed: "—" },
      { name: "feeding_calc", desc: "Calcula porciones por edad/peso", lastUsed: "1d" },
    ],
  },
  {
    id: "gitbonsai",
    name: "GitBonsai",
    handle: "gitbonsai",
    emoji: "🍎",
    status: "thinking",
    model: "claude-sonnet-4.5",
    tags: ["dev", "git"],
    tokens: 4210,
    cost: 0.09,
    lastActive: Date.now() - 1000 * 60 * 2,
    unread: 1,
    messages: [
      { id: "g1", role: "user", text: "hola", t: dayAgo(0, 19, 2) },
      { id: "g2", role: "agent", text: "¡Hola! ¿En qué te puedo ayudar hoy?", t: dayAgo(0, 19, 2) },
      { id: "g3", role: "user", text: "necesito hacer rebase de feature/auth contra main", t: dayAgo(0, 21, 7) },
      {
        id: "g4", role: "tool",
        tool: "git_status",
        args: "branch: feature/auth",
        output: "ahead 7 · behind 23\n2 archivos sin commitear",
        t: dayAgo(0, 21, 7)
      },
    ],
    toolsAvailable: [
      { name: "git_status", desc: "Estado del repo actual", lastUsed: "2m" },
      { name: "git_rebase", desc: "Rebase interactivo asistido", lastUsed: "—" },
      { name: "pr_review", desc: "Análisis de pull request", lastUsed: "3h" },
      { name: "conflict_resolver", desc: "Sugerencias de merge", lastUsed: "—" },
    ],
  },
  {
    id: "eurocenter",
    name: "EuroCenter",
    handle: "eurocenter",
    emoji: "🏛️",
    status: "idle",
    model: "gpt-5",
    tags: ["finance", "data"],
    tokens: 0,
    cost: 0,
    lastActive: Date.now() - 1000 * 60 * 60 * 4,
    unread: 0,
    messages: [],
    toolsAvailable: [
      { name: "fx_rates", desc: "Tipos de cambio en vivo", lastUsed: "—" },
      { name: "ecb_press", desc: "Comunicados del BCE", lastUsed: "—" },
    ],
  },
  {
    id: "scout",
    name: "Scout",
    handle: "scout",
    emoji: "🛰️",
    status: "tool",
    model: "claude-sonnet-4.5",
    tags: ["research", "web"],
    tokens: 32890,
    cost: 0.78,
    lastActive: Date.now() - 1000 * 30,
    unread: 3,
    messages: [
      { id: "s1", role: "user", text: "investiga sobre energía mareomotriz en europa", t: dayAgo(0, 20, 50) },
      {
        id: "s2", role: "tool",
        tool: "web_search",
        args: '"tidal energy europe 2026"',
        output: "→ 47 resultados · filtrando por relevancia…",
        t: dayAgo(0, 20, 51)
      },
      { id: "s3", role: "agent", text: "Encontré 47 fuentes. Las más relevantes son del MeyGen Project (Escocia) y EDF (Francia). Sigo procesando…", t: dayAgo(0, 21, 8) },
    ],
    toolsAvailable: [
      { name: "web_search", desc: "Búsqueda web con ranking", lastUsed: "30s" },
      { name: "fetch_url", desc: "Lee una página", lastUsed: "1m" },
      { name: "summarize", desc: "Resume documentos largos", lastUsed: "5m" },
    ],
  },
  {
    id: "atlas",
    name: "Atlas",
    handle: "atlas",
    emoji: "🗺️",
    status: "idle",
    model: "claude-haiku-4.5",
    tags: ["travel"],
    tokens: 8200,
    cost: 0.04,
    lastActive: Date.now() - 1000 * 60 * 60 * 26,
    unread: 0,
    messages: [
      { id: "a1", role: "user", text: "ruta para 5 días en Lisboa", t: dayAgo(2, 14, 0) },
      { id: "a2", role: "agent", text: "Te armé un itinerario de 5 días balanceando barrios históricos (Alfama, Baixa) con miradores y un día en Sintra. ¿Lo quieres en PDF o markdown?", t: dayAgo(2, 14, 2) },
    ],
    toolsAvailable: [
      { name: "maps_search", desc: "Busca lugares y rutas", lastUsed: "1d" },
      { name: "weather", desc: "Pronóstico por ciudad", lastUsed: "1d" },
    ],
  },
  {
    id: "lex",
    name: "Lex",
    handle: "lex",
    emoji: "⚖️",
    status: "error",
    model: "gpt-5",
    tags: ["legal"],
    tokens: 12010,
    cost: 0.31,
    lastActive: Date.now() - 1000 * 60 * 18,
    unread: 0,
    messages: [
      { id: "l1", role: "user", text: "redacta cláusula de confidencialidad estándar", t: dayAgo(0, 20, 30) },
      { id: "l2", role: "agent", text: "Error al acceder a la base legal. Reintentando…", t: dayAgo(0, 20, 31) },
    ],
    toolsAvailable: [
      { name: "legal_db", desc: "Consulta jurisprudencia", lastUsed: "18m" },
      { name: "draft_clause", desc: "Genera cláusulas", lastUsed: "—" },
    ],
  },
  {
    id: "mira",
    name: "Mira",
    handle: "mira",
    emoji: "🎨",
    status: "idle",
    model: "claude-sonnet-4.5",
    tags: ["design", "creative"],
    tokens: 22100,
    cost: 0.51,
    lastActive: Date.now() - 1000 * 60 * 60 * 8,
    unread: 0,
    messages: [
      { id: "m1", role: "user", text: "paletas para una app de meditación", t: dayAgo(0, 13, 0) },
      { id: "m2", role: "agent", text: "Te propongo tres direcciones: lavanda + crema (calmada), salvia + arena (terrosa), y noche profunda + dorado (introspectiva). Te dejo los hexes en un canvas.", t: dayAgo(0, 13, 4) },
    ],
    toolsAvailable: [
      { name: "palette_gen", desc: "Genera paletas armónicas", lastUsed: "8h" },
      { name: "color_check", desc: "Contraste WCAG", lastUsed: "8h" },
    ],
  },
  {
    id: "nova",
    name: "Nova",
    handle: "nova",
    emoji: "✨",
    status: "thinking",
    model: "claude-sonnet-4.5",
    tags: ["writing"],
    tokens: 5400,
    cost: 0.13,
    lastActive: Date.now() - 1000 * 60 * 1,
    unread: 2,
    messages: [
      { id: "n1", role: "user", text: "ayúdame con el opening de un thriller", t: dayAgo(0, 21, 6) },
    ],
    toolsAvailable: [
      { name: "style_check", desc: "Análisis de estilo", lastUsed: "1m" },
    ],
  },
];

function dayAgo(d, h, m) {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  dt.setHours(h, m, 0, 0);
  return dt.getTime();
}

window.SEED_AGENTS = SEED_AGENTS;
