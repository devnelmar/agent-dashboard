/* global React, ReactDOM, SEED_AGENTS */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ===================== Icons ===================== */
const Icon = ({ d, size = 16, fill = "none", stroke = "currentColor", sw = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
    <path d={d} />
  </svg>
);
const Search = (p) => <Icon d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.3-4.3" {...p} />;
const Send = (p) => <Icon d="m22 2-7 20-4-9-9-4Zm0 0L11 13" {...p} />;
const Plus = (p) => <Icon d="M12 5v14M5 12h14" {...p} />;
const Menu = (p) => <Icon d="M3 6h18M3 12h18M3 18h18" {...p} />;
const X = (p) => <Icon d="M18 6 6 18M6 6l12 12" {...p} />;
const Sun = (p) => <Icon d="M12 3v2m0 14v2M5.6 5.6l1.4 1.4m10 10 1.4 1.4M3 12h2m14 0h2M5.6 18.4l1.4-1.4m10-10 1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" {...p} />;
const Moon = (p) => <Icon d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" {...p} />;
const ChevDown = (p) => <Icon d="m6 9 6 6 6-6" {...p} />;
const Sparkles = (p) => <Icon d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" {...p} />;
const Settings = (p) => <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.5 7.5 0 0 0-.1-1.4l2-1.5-2-3.4-2.3.8a7.5 7.5 0 0 0-2.4-1.4L14 2h-4l-.6 2.4a7.5 7.5 0 0 0-2.4 1.4l-2.3-.8-2 3.4 2 1.5a7.7 7.7 0 0 0 0 2.8l-2 1.5 2 3.4 2.3-.8a7.5 7.5 0 0 0 2.4 1.4L10 22h4l.6-2.4a7.5 7.5 0 0 0 2.4-1.4l2.3.8 2-3.4-2-1.5c.1-.5.1-.9.1-1.4Z" {...p} />;
const Trash = (p) => <Icon d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" {...p} />;
const Tool = (p) => <Icon d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5 2.5-2.5Z" {...p} />;
const Stop = (p) => <Icon d="M5 5h14v14H5z" {...p} />;

/* ===================== Helpers ===================== */
function fmtTime(t) {
  const d = new Date(t);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}
function fmtRel(t) {
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
function fmtCost(c) { return `$${c.toFixed(2)}`; }
function fmtTokens(n) {
  if (n < 1000) return `${n}`;
  if (n < 1e6) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1e6).toFixed(1)}M`;
}
function dayLabel(t) {
  const d = new Date(t);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  if (isToday) return "Hoy";
  if (d.toDateString() === yest.toDateString()) return "Ayer";
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
}

const STATUS_LABEL = {
  idle: "idle",
  thinking: "pensando",
  tool: "ejecutando",
  error: "error",
  active: "activo",
};

/* ===================== App ===================== */
function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  const [accentH, setAccentH] = useState(() => +localStorage.getItem("accentH") || 280);
  const [density, setDensity] = useState(() => localStorage.getItem("density") || "comfortable");
  const [agents, setAgents] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [connected, setConnected] = useState(false);

  // Poll API every 4s
  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/status");
        if (!res.ok) { setConnected(false); return; }
        const data = await res.json();
        const list = Object.values(data);
        setConnected(true);
        setAgents((prev) => {
          if (prev.length === 0 && list.length > 0 && !activeId) {
            setActiveId(list[0].id);
          }
          return list;
        });
      } catch (_) { setConnected(false); }
    }
    poll();
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.style.setProperty("--accent-h", accentH);
    localStorage.setItem("accentH", accentH);
  }, [accentH]);
  useEffect(() => { localStorage.setItem("density", density); }, [density]);

  // Listen for tweak panel updates
  useEffect(() => {
    function onMsg(e) {
      const d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "__edit_mode_set_keys" && d.edits) {
        if (d.edits.theme) setTheme(d.edits.theme);
        if (typeof d.edits.accentH === "number") setAccentH(d.edits.accentH);
        if (d.edits.density) setDensity(d.edits.density);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Cmd+K focus search
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.querySelector(".search input")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const active = agents.find((a) => a.id === activeId) || agents[0];

  const filtered = useMemo(() => {
    let list = agents;
    if (filter !== "all") list = list.filter((a) => a.status === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        a.handle.includes(q) ||
        a.tags.some((t) => t.includes(q))
      );
    }
    return list;
  }, [agents, query, filter]);

  const counts = useMemo(() => ({
    all: agents.length,
    thinking: agents.filter((a) => a.status === "thinking").length,
    tool: agents.filter((a) => a.status === "tool").length,
    error: agents.filter((a) => a.status === "error").length,
  }), [agents]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || !activeId) return;
    // Optimistic UI — add user message immediately
    const userMsg = { id: `u${Date.now()}`, role: "user", text, t: Date.now() };
    setAgents((prev) => prev.map((a) =>
      a.id === activeId
        ? { ...a, messages: [...a.messages, userMsg], status: "thinking", lastActive: Date.now(), unread: 0 }
        : a
    ));
    try {
      await fetch(`/api/agents/${activeId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
    } catch (_) {}
  }, [activeId]);

  const interrupt = useCallback(async () => {
    if (!activeId) return;
    try {
      await fetch(`/api/agents/${activeId}/interrupt`, { method: "POST" });
    } catch (_) {}
  }, [activeId]);

  const clearChat = useCallback(() => {
    if (!confirm("¿Borrar la conversación?")) return;
    setAgents((prev) => prev.map((a) => a.id === activeId ? { ...a, messages: [] } : a));
  }, [activeId]);

  return (
    <>
      <div className="backdrop" />
      <div className={`app ${density === "compact" ? "is-compact" : ""}`}>
        <Sidebar
          open={sidebarOpen}
          agents={filtered}
          activeId={activeId}
          query={query} setQuery={setQuery}
          filter={filter} setFilter={setFilter}
          counts={counts}
          onPick={(id) => { setActiveId(id); setSidebarOpen(false); }}
          theme={theme} setTheme={setTheme}
          connected={connected}
        />
        <div className={`sidebar-scrim ${sidebarOpen ? "show" : ""}`} onClick={() => setSidebarOpen(false)} />
        <Main
          agent={active}
          onSend={sendMessage}
          onInterrupt={interrupt}
          onClear={clearChat}
          drawerOpen={drawerOpen}
          setDrawerOpen={setDrawerOpen}
          onMenu={() => setSidebarOpen(true)}
        />
      </div>
      <TweaksRoot
        theme={theme} setTheme={setTheme}
        accentH={accentH} setAccentH={setAccentH}
        density={density} setDensity={setDensity}
      />
    </>
  );
}

/* ===================== Sidebar ===================== */
function Sidebar({ open, agents, activeId, query, setQuery, filter, setFilter, counts, onPick, theme, setTheme, connected }) {
  const totalActive = agents.filter((a) => a.status !== "idle").length;
  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="sidebar-head">
        <div className="brand">
          <div className="brand-mark" />
          <div className="brand-text">
            <span className="brand-name">Hermes</span>
            <span className="brand-sub">Agent Dashboard</span>
          </div>
          <div className="brand-spacer" />
          <button className="icon-btn" title={theme === "dark" ? "Claro" : "Oscuro"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun /> : <Moon />}
          </button>
        </div>

        <div className="search">
          <span className="search-icon"><Search size={14} /></span>
          <input placeholder="Buscar agente o tag…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <span className="search-key">⌘K</span>
        </div>

        <div className="filter-row">
          <button className={`chip ${filter === "all" ? "is-active" : ""}`} onClick={() => setFilter("all")}>
            Todos <span className="chip-count">{counts.all}</span>
          </button>
          <button className={`chip ${filter === "thinking" ? "is-active" : ""}`} onClick={() => setFilter("thinking")}>
            Pensando <span className="chip-count">{counts.thinking}</span>
          </button>
          <button className={`chip ${filter === "tool" ? "is-active" : ""}`} onClick={() => setFilter("tool")}>
            Tool <span className="chip-count">{counts.tool}</span>
          </button>
          <button className={`chip ${filter === "error" ? "is-active" : ""}`} onClick={() => setFilter("error")}>
            Error <span className="chip-count">{counts.error}</span>
          </button>
        </div>
      </div>

      <div className="agent-list">
        {agents.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--fg-2)", fontSize: 13 }}>
            Sin resultados
          </div>
        )}
        {agents.map((a) => (
          <button key={a.id}
            className={`agent-item ${a.id === activeId ? "is-active" : ""}`}
            onClick={() => onPick(a.id)}>
            <div className="avatar">
              {a.emoji}
              <span className="avatar-status" style={{ background: `var(--status-${a.status})` }} />
            </div>
            <div className="agent-meta">
              <span className="agent-name">{a.name}</span>
              <span className="agent-handle">@{a.handle} · {STATUS_LABEL[a.status]}</span>
            </div>
            <div className="agent-aside">
              <span className="agent-time">{fmtRel(a.lastActive)}</span>
              {a.unread > 0 && <span className="agent-unread">{a.unread}</span>}
            </div>
          </button>
        ))}
      </div>

      <div className="sidebar-foot">
        <span className="dot" style={{ background: connected ? "var(--status-active)" : "var(--status-error)", boxShadow: connected ? "0 0 8px var(--status-active)" : "0 0 8px var(--status-error)" }} />
        <span className="foot-stat"><strong>{totalActive}</strong> activos</span>
        <span className="foot-stat" style={{ marginLeft: "auto", color: connected ? "var(--status-active)" : "var(--status-error)" }}>
          {connected ? "conectado" : "desconectado"}
        </span>
      </div>
    </aside>
  );
}

/* ===================== Main ===================== */
function Main({ agent, onSend, onInterrupt, onClear, drawerOpen, setDrawerOpen, onMenu }) {
  const convoRef = useRef(null);
  const [input, setInput] = useState("");
  const taRef = useRef(null);

  useEffect(() => {
    if (!agent || !convoRef.current) return;
    convoRef.current.scrollTop = convoRef.current.scrollHeight;
  }, [agent?.id, agent?.messages?.length, agent?.status]);

  // When the tool drawer toggles, the convo's flex height changes mid-animation.
  // If the user was anchored near the bottom, keep them anchored as the drawer slides.
  useEffect(() => {
    const el = convoRef.current;
    if (!el) return;
    const wasNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (!wasNearBottom) return;
    let raf = 0;
    const tick = () => {
      el.scrollTop = el.scrollHeight;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const stop = setTimeout(() => cancelAnimationFrame(raf), 380);
    return () => { cancelAnimationFrame(raf); clearTimeout(stop); };
  }, [drawerOpen]);

  function autoGrow(e) {
    e.target.style.height = "auto";
    e.target.style.height = Math.min(160, e.target.scrollHeight) + "px";
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        onSend(input);
        setInput("");
        if (taRef.current) taRef.current.style.height = "auto";
      }
    }
  }

  // Group messages with day dividers
  const grouped = useMemo(() => {
    if (!agent) return [];
    const out = [];
    let lastDay = null;
    agent.messages.forEach((m) => {
      if (m.role === "tool") return;  // tool calls only in ToolDrawer, not chat
      const day = new Date(m.t).toDateString();
      if (day !== lastDay) {
        out.push({ type: "day", label: dayLabel(m.t), key: `d-${day}` });
        lastDay = day;
      }
      out.push({ type: "msg", msg: m, key: m.id });
    });
    return out;
  }, [agent?.messages]);

  if (!agent) {
    return (
      <section className="main">
        <div className="convo" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="empty">
            <div className="empty-mark"><Sparkles size={22} /></div>
            <div style={{ fontSize: 15, color: "var(--fg-0)", fontWeight: 550 }}>
              Conectando con agentes…
            </div>
            <div style={{ fontSize: 13, maxWidth: 320, color: "var(--fg-2)" }}>
              Esperando respuesta del servidor
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="main">
      <header className="main-head">
        <button className="icon-btn mobile-toggle" onClick={onMenu}><Menu /></button>
        <div className="avatar">
          {agent.emoji}
          <span className="avatar-status" style={{ background: `var(--status-${agent.status})` }} />
        </div>
        <div className="main-head-title">
          <span className="main-head-name">
            {agent.name}
            <span className={`status-pill ${agent.status}`}>
              <span className="ind" />
              {STATUS_LABEL[agent.status]}
            </span>
          </span>
          <span className="main-head-meta">
            <span>@{agent.handle}</span>
            <span className="meta-sep">·</span>
            <span>{agent.model}</span>
            <span className="meta-sep">·</span>
            <span>{fmtTokens(agent.tokens)} tokens</span>
            <span className="meta-sep">·</span>
            <span>{fmtCost(agent.cost)}</span>
            {agent.tags.length > 0 && <span className="meta-sep">·</span>}
            {agent.tags.map((t) => <span key={t} className="tag">#{t}</span>)}
          </span>
        </div>
        <div className="main-head-actions">
          <button className="icon-btn" onClick={onInterrupt}
            disabled={agent?.status !== "thinking"}
            title={agent?.status === "thinking"
              ? "Interrumpir (envía Ctrl+C)"
              : "El agente está idle — interrumpir podría dejarlo en un estado raro"}
            style={{ opacity: agent?.status === "thinking" ? 1 : 0.35,
                     cursor: agent?.status === "thinking" ? "pointer" : "not-allowed" }}>
            <Stop size={15} />
          </button>
          <button className="icon-btn" title="Borrar conversación" onClick={onClear}><Trash size={15} /></button>
          <button className="icon-btn" title="Configuración"><Settings size={15} /></button>
        </div>
      </header>

      <div className="convo" ref={convoRef}>
        {grouped.length === 0 ? (
          <div className="empty">
            <div className="empty-mark"><Sparkles size={22} /></div>
            <div style={{ fontSize: 15, color: "var(--fg-0)", fontWeight: 550 }}>
              Empieza a chatear con {agent.name}
            </div>
            <div style={{ fontSize: 13, maxWidth: 320 }}>
              Escribe abajo para iniciar. {agent.name} usa <code style={{ fontFamily: "var(--font-mono)" }}>{agent.model}</code> y tiene {agent.toolsAvailable.length} herramientas disponibles.
            </div>
          </div>
        ) : (
          <div className="convo-inner">
            {grouped.map((it) => it.type === "day"
              ? <div key={it.key} className="day-divider"><span>{it.label}</span></div>
              : <Message key={it.key} m={it.msg} agent={agent} />
            )}
            {agent.status === "thinking" && (
              <div className="msg-row">
                <div className="msg-avatar">{agent.emoji}</div>
                <div className="bubble from-agent">
                  <div className="typing"><span /><span /><span /></div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ToolDrawer open={drawerOpen} setOpen={setDrawerOpen} agent={agent} />

      <div className="composer-wrap">
        <div className="composer">
          <textarea ref={taRef} placeholder={`Mensaje para ${agent.name}…`}
            value={input} onChange={(e) => { setInput(e.target.value); autoGrow(e); }}
            onKeyDown={handleKey} rows={1} />
          <div className="composer-actions">
            <button className="send-btn" disabled={!input.trim()}
              onClick={() => { onSend(input); setInput(""); if (taRef.current) taRef.current.style.height = "auto"; }}>
              <Send size={14} /> Enviar
            </button>
          </div>
        </div>
        <div className="composer-foot">
          <span><kbd>Enter</kbd> enviar</span>
          <span><kbd>Shift</kbd> + <kbd>Enter</kbd> nueva línea</span>
          <span style={{ marginLeft: "auto" }}>{agent.model}</span>
        </div>
      </div>
    </section>
  );
}

/* ===================== Message ===================== */
function Message({ m, agent }) {
  if (m.role === "tool") {
    return (
      <div className="msg-row">
        <div className="msg-avatar"><Tool size={14} /></div>
        <div className="tool-call">
          <div className="tool-call-head">
            <Tool size={12} />
            <span className="lbl">tool call</span>
            <span className="tool-call-name">{m.tool}</span>
            <span style={{ marginLeft: "auto", color: "var(--fg-3)" }}>{fmtTime(m.t)}</span>
          </div>
          <div className="tool-call-body">
            <div style={{ color: "var(--fg-2)", marginBottom: 6 }}>args: {m.args}</div>
            <div>{m.output}</div>
          </div>
        </div>
      </div>
    );
  }
  if (m.role === "user") {
    return (
      <div className="msg-row from-user">
        <div className="bubble from-user">
          <div>{m.text}</div>
          <span className="bubble-time">{fmtTime(m.t)}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="msg-row">
      <div className="msg-avatar">{agent.emoji}</div>
      <div className="bubble from-agent">
        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} />
        <span className="bubble-time">{fmtTime(m.t)}</span>
      </div>
    </div>
  );
}

function renderMarkdown(s) {
  const escaped = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, '<code style="font-family:var(--font-mono);background:var(--bg-3);padding:1px 5px;border-radius:4px;font-size:.92em">$1</code>')
    .replace(/\n/g, "<br>");
}

/* ===================== Tool Drawer ===================== */
// Tool calls share a timestamp per agent turn (the parser sees a whole turn at
// once and stamps it with the time of first observation). Showing a separate
// "X minutes ago" per row would be misleading — every row in the same turn
// would show the same value. Group by turn instead and show one time label.
function ToolDrawer({ open, setOpen, agent }) {
  const { groups, totalCalls, uniqueCount } = useMemo(() => {
    if (!agent) return { groups: [], totalCalls: 0, uniqueCount: 0 };
    const tools = agent.messages.filter((m) => m.role === "tool");
    const groups = [];
    for (const t of tools) {
      const last = groups[groups.length - 1];
      if (last && Math.abs(t.t - last.t) < 5000) {
        last.tools.push(t);
      } else {
        groups.push({ t: t.t, tools: [t] });
      }
    }
    groups.reverse();  // newest first
    const names = new Set();
    for (const g of groups) for (const t of g.tools) if (t.name) names.add(t.name);
    return { groups, totalCalls: tools.length, uniqueCount: names.size };
  }, [agent?.messages]);

  return (
    <div className={`tool-drawer ${open ? "expanded" : "collapsed"}`}>
      <div className="tool-drawer-head" onClick={() => setOpen(!open)}>
        <Tool size={12} />
        <span>Tool Output</span>
        <span className="tool-drawer-count">
          {totalCalls === 0
            ? "sin uso"
            : `${totalCalls} ${totalCalls === 1 ? "llamada" : "llamadas"} · ${uniqueCount} ${uniqueCount === 1 ? "tool" : "tools"}`}
        </span>
        <ChevDown size={14} className="chev" />
      </div>
      <div className="tool-drawer-body">
        {totalCalls === 0 ? (
          <div className="tool-empty">aún no se han usado herramientas</div>
        ) : groups.map((g) => (
          <div className="tool-group" key={g.t}>
            <div className="tool-group-head">
              <span className="tool-group-time">{fmtTime(g.t)}</span>
              <span className="tool-group-rel">{fmtRel(g.t)}</span>
              <span className="tool-group-count">
                {g.tools.length} {g.tools.length === 1 ? "llamada" : "llamadas"}
              </span>
            </div>
            <div className="tool-group-rows">
              {g.tools.map((c, ti) => (
                <div className="tool-row" key={`${g.t}-${ti}`}>
                  <span className="ico">{c.tool || "▸"}</span>
                  <span className="nm">{c.name || "—"}</span>
                  <span className="desc" title={c.args || ""}>{c.args || ""}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===================== Tweaks ===================== */
function TweaksRoot({ theme, setTheme, accentH, setAccentH, density, setDensity }) {
  const TP = window.TweaksPanel;
  const TR = window.TweakRadio;
  const TS = window.TweakSlider;
  const TSe = window.TweakSection;
  if (!TP) return null;

  return (
    <TP title="Tweaks">
      <TSe title="Apariencia">
        <TR label="Tema" value={theme} onChange={setTheme}
          options={[{ label: "Oscuro", value: "dark" }, { label: "Claro", value: "light" }]} />
        <TR label="Densidad" value={density} onChange={setDensity}
          options={[{ label: "Cómodo", value: "comfortable" }, { label: "Compacto", value: "compact" }]} />
      </TSe>
      <TSe title="Color de acento">
        <TS label="Hue" value={accentH} min={0} max={360} step={1} onChange={setAccentH} />
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          {[280, 230, 200, 160, 30, 350].map((h) => (
            <button key={h} onClick={() => setAccentH(h)}
              style={{
                width: 24, height: 24, borderRadius: "50%",
                background: `oklch(0.7 0.18 ${h})`,
                border: accentH === h ? "2px solid var(--fg-0)" : "1px solid var(--line)",
                cursor: "pointer",
              }} />
          ))}
        </div>
      </TSe>
    </TP>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
