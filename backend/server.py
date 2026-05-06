#!/usr/bin/env python3
"""
Agent Dashboard Backend — Flask edition.
Run: python3 server.py  (from backend/)
"""

import json
import subprocess
import os
import re
import time
import threading

from flask import Flask, jsonify, request, send_from_directory, abort
from flask_cors import CORS

# ─── Config ───────────────────────────────────────────────────────────────────

PORT = 9120
HOST = "127.0.0.1"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "frontend"))

AGENTS = {
    "doggo": {
        "name": "DogGo",
        "session": "doggo-agent",
        "emoji": "🐕",
        "profile": "doggo",
        "project": "DogGo",
    },
    "gitbonsai": {
        "name": "GitBonsai",
        "session": "gitbonsai-agent",
        "emoji": "🌱",
        "profile": "gitbonsai",
        "project": "GitBonsai",
    },
    "eurocenter": {
        "name": "EuroCenter",
        "session": "eurocenter-agent",
        "emoji": "🏦",
        "profile": "eurocenter",
        "project": "EuroCenter",
    },
    "megan": {
        "name": "Megan",
        "session": "megan-agent",
        "emoji": "👩",
        "profile": "megan",
        "project": "JobHunter",
    },
}

TOOL_EMOJIS = [
    "📄", "💻", "🔍", "❌", "✅", "⚙️", "🛠️", "📝", "📡", "🐛", "🔧", "🐍",
]

MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf",
}

# ─── ANSI stripping ───────────────────────────────────────────────────────────

_ANSI_RE = re.compile(r"\x1b(?:\[[0-9;?]*[A-Za-z]|\][^\x07]*\x07|[^[\]])")


def strip_ansi(text: str) -> str:
    return _ANSI_RE.sub("", text)


# ─── In-memory message store ──────────────────────────────────────────────────

_store_lock = threading.Lock()
_store: dict = {key: {"messages": []} for key in AGENTS}

# ─── tmux helpers ─────────────────────────────────────────────────────────────


def capture_pane(session: str) -> list:
    """Capture last 200 lines of a tmux pane."""
    try:
        result = subprocess.run(
            ["tmux", "capture-pane", "-t", session, "-p", "-S", "-200"],
            capture_output=True, text=True, timeout=5,
        )
        raw = strip_ansi(result.stdout)
        return raw.split("\n")
    except Exception:
        return []


def is_busy(lines: list, profile: str) -> bool:
    """True if agent has no prompt at the end of the capture."""
    for line in reversed(lines):
        s = line.strip()
        if not s:
            continue
        if re.match(r"^─+$", s):
            continue
        # First significant line from end must be the prompt to be idle
        if re.match(rf"^{re.escape(profile)}\s*❯\s*$", s):
            return False
        return True
    return False


def is_tool_call_line(line: str) -> bool:
    """True if line represents a tool call."""
    s = line.strip()
    if not s:
        return False
    # Strip box-drawing prefix characters (┊, │, etc.) used inside Hermes panels
    s = re.sub(r'^[┊┆┇┈┉┋│]\s*', '', s)
    if not any(s.startswith(e) for e in TOOL_EMOJIS):
        return False
    # Exclude form borders, status bar, prompt
    if any(c in line for c in ("╭", "╰", "│", "❯")):
        return False
    # Exclude status bar lines (⚕ + timing indicators)
    if "⚕" in line and any(x in line for x in ("⏲", "⏱", "░", "K/", "M/", "ctx")):
        return False
    return True


# ─── Parser ───────────────────────────────────────────────────────────────────


def _join_form_lines(lines: list) -> str:
    """
    Reconstruct word-wrapped text from inside a Hermes form box.
    - Lines with 4-space indent = new paragraph.
    - Lines without indent = word-wrap continuation (concatenate directly).
    - Empty lines = paragraph separator.
    """
    paragraphs = []
    current = []

    for l in lines:
        if not l.strip():
            if current:
                paragraphs.append("".join(current))
                current = []
        elif l.startswith("    "):       # 4-space indent → new paragraph
            if current:
                paragraphs.append("".join(current))
                current = []
            current.append(l[4:])        # strip the leading 4 spaces
        else:
            current.append(l)            # word-wrap continuation

    if current:
        paragraphs.append("".join(current))

    return "\n".join(paragraphs).strip()


def parse_capture(lines: list) -> list:
    """
    Parse tmux capture lines into message events.
    Returns: [{"role": "user"|"agent", "content": str, "tool_calls": [str]}]
    """
    events = []
    pending_tool_calls = []
    i = 0

    while i < len(lines):
        line = lines[i]

        # Skip empty lines
        if not line.strip():
            i += 1
            continue

        # Skip pure separator lines ─────────────────
        if re.match(r"^\s*─+\s*$", line):
            i += 1
            continue

        # Skip status bar:  ⚕ model │ tokens │ [░░] │ time │ ⏲/⏱ Ns
        if "⚕" in line and any(x in line for x in ("⏲", "⏱", "░", "K/", "M/", "ctx")):
            i += 1
            continue

        # Tool call line
        if is_tool_call_line(line):
            # Strip box-drawing prefix before storing
            cleaned = re.sub(r'^[┊┆┇┈┉┋│]\s*', '', line.strip())
            pending_tool_calls.append(cleaned)
            i += 1
            continue

        # User message: ● text
        if line.strip().startswith("●"):
            content = line.strip()[1:].strip()
            if content and content != "Initializing agent...":
                events.append({
                    "role": "user",
                    "content": content,
                    "tool_calls": [],
                })
                pending_tool_calls = []
            i += 1
            continue

        # Agent response form: ╭─ ⚕ Hermes ─...─╮
        if "╭─" in line and "⚕" in line and "Hermes" in line:
            form_lines = []
            i += 1
            while i < len(lines):
                l = lines[i]
                if l.strip().startswith("╰") or "╰─" in l:
                    break
                form_lines.append(l.rstrip())
                i += 1
            content = _join_form_lines(form_lines)
            if content:
                events.append({
                    "role": "agent",
                    "content": content,
                    "tool_calls": pending_tool_calls[:],
                })
                pending_tool_calls = []
            i += 1     # skip the ╰ line
            continue

        i += 1

    return events


# ─── Message store update ─────────────────────────────────────────────────────


def update_messages(agent_key: str, events: list) -> list:
    """
    Merge parsed events into the in-memory store, preserving timestamps.
    New events get the current timestamp; known events keep their original one.
    """
    with _store_lock:
        old = _store[agent_key]["messages"]
        result = []
        old_idx = 0

        for ev in events:
            fp = ev["role"] + ":" + ev["content"][:80]
            found = False
            for j in range(old_idx, len(old)):
                ofp = old[j]["role"] + ":" + old[j]["content"][:80]
                if ofp == fp:
                    m = dict(old[j])
                    m["content"] = ev["content"]
                    if ev.get("tool_calls"):
                        m["tool_calls"] = ev["tool_calls"]
                    result.append(m)
                    old_idx = j + 1
                    found = True
                    break
            if not found:
                result.append({
                    "role": ev["role"],
                    "content": ev["content"],
                    "timestamp": int(time.time()),
                    "tool_calls": ev.get("tool_calls", []),
                })

        _store[agent_key]["messages"] = result
        return result


# ─── Model resolver ───────────────────────────────────────────────────────────

def _get_model(profile: str) -> str:
    """Read the model from the agent's config.yaml."""
    import yaml
    config_path = os.path.expanduser(f"~/.hermes/profiles/{profile}/config.yaml")
    try:
        with open(config_path) as f:
            cfg = yaml.safe_load(f)
        provider = cfg.get("model", {}).get("provider", "?")
        model = cfg.get("model", {}).get("default", "?")
        return f"{model}" if provider == "?" else model
    except Exception:
        return "?"

# ─── Status aggregation ───────────────────────────────────────────────────────

def _parse_tokens(lines: list) -> int:
    """Extract token count from the Hermes status bar in tmux capture.
    Status bar format: ⚕ model │ 16.6K/1M │ [░░] 2% │ time │ ⏲ Ns
    When no data yet:  ⚕ model │ ctx -- │ [░░] -- │ time │ ⏲ Ns
    """
    for line in reversed(lines):
        if "⚕" not in line:
            continue
        # Must be a status bar (has pipe separators and timing)
        if not any(x in line for x in ("⏲", "⏱", "░", "K/", "M/", "ctx")):
            continue
        parts = line.split("│")
        if len(parts) < 2:
            continue
        token_part = parts[1].strip()  # e.g. "16.6K/1M" or "ctx --"
        if "/" not in token_part:
            continue
        used = token_part.split("/")[0].strip()  # "16.6K" or "0"
        if not used:
            return 0
        try:
            if used.endswith("K"):
                return int(float(used[:-1]) * 1000)
            elif used.endswith("M"):
                return int(float(used[:-1]) * 1_000_000)
            else:
                return int(used)
        except (ValueError, IndexError):
            return 0
    return 0


def _map_status(backend_status: str) -> str:
    """Map backend status to frontend status."""
    return "thinking" if backend_status == "busy" else "idle"

def _fmt_message(idx: int, msg: dict) -> dict:
    """Convert backend message format to frontend format."""
    ts = msg.get("timestamp", int(time.time())) * 1000  # seconds → ms
    tc = msg.get("tool_calls", [])
    role = msg["role"]
    content = msg.get("content", "")

    # Create tool messages for each tool call
    msgs = []
    if role == "agent" and tc:
        for tci, tc_text in enumerate(tc):
            parts = tc_text.split(" ") if tc_text else []
            emoji = parts[0] if len(parts) > 0 else "tool"
            name = parts[1] if len(parts) > 1 else ""
            args = " ".join(parts[2:]) if len(parts) > 2 else ""
            msgs.append({
                "id": f"{role}-{idx}-t{tci}",
                "role": "tool",
                "tool": emoji,
                "name": name,
                "args": args,
                "output": "",
                "t": ts + tci,
            })
    msgs.append({
        "id": f"{role}-{idx}",
        "role": role,
        "text": content,
        "t": ts,
    })
    return msgs


def get_status() -> dict:
    result = {}
    for key, agent in AGENTS.items():
        lines = capture_pane(agent["session"])
        busy = is_busy(lines, agent["profile"])
        events = parse_capture(lines)
        messages = update_messages(key, events)

        # Convert messages to frontend format
        frontend_msgs = []
        for idx, msg in enumerate(messages):
            frontend_msgs.extend(_fmt_message(idx, msg))

        result[key] = {
            "id": key,
            "name": agent["name"],
            "handle": agent["profile"],
            "emoji": agent["emoji"],
            "status": _map_status("busy" if busy else "idle"),
            "model": _get_model(agent["profile"]),
            "tags": [agent.get("project", "").lower()],
            "tokens": _parse_tokens(lines),
            "cost": 0,
            "lastActive": int(time.time() * 1000),
            "unread": 0,
            "messages": frontend_msgs,
            "toolsAvailable": [],
        }
    return result


# ─── Flask app ────────────────────────────────────────────────────────────────

app = Flask(__name__, static_folder=FRONTEND_DIR)
CORS(app)


@app.route("/")
@app.route("/index.html")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/api/status")
def api_status():
    try:
        return jsonify(get_status())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/agents/<key>/message", methods=["POST"])
def api_message(key):
    if key not in AGENTS:
        return jsonify({"error": "unknown agent"}), 404
    data = request.get_json(silent=True) or {}
    message = str(data.get("message", "")).strip()
    if not message:
        return jsonify({"error": "empty message"}), 400
    subprocess.run(
        ["tmux", "send-keys", "-t", AGENTS[key]["session"], message, "Enter"],
        timeout=5,
    )
    with _store_lock:
        _store[key]["messages"].append({
            "role": "user",
            "content": message,
            "timestamp": int(time.time()),
            "tool_calls": [],
        })
    return jsonify({"ok": True})


@app.route("/api/agents/<key>/interrupt", methods=["POST"])
def api_interrupt(key):
    if key not in AGENTS:
        return jsonify({"error": "unknown agent"}), 404
    subprocess.run(
        ["tmux", "send-keys", "-t", AGENTS[key]["session"], "C-c"],
        timeout=5,
    )
    return jsonify({"ok": True})


@app.route("/<path:filename>")
def static_files(filename):
    safe = os.path.normpath(filename)
    if safe.startswith("..") or os.path.isabs(safe):
        abort(403)
    return send_from_directory(FRONTEND_DIR, safe)


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"Agent Dashboard  →  http://{HOST}:{PORT}")
    print(f"Frontend dir     →  {FRONTEND_DIR}")
    print("Ctrl+C to stop")
    app.run(host=HOST, port=PORT, threaded=True)
