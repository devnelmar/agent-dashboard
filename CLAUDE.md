# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Run

```bash
cd backend && python3 server.py
```

Serves dashboard at http://127.0.0.1:9120. Flask backend + single static `frontend/index.html`. Dependencies: Flask, flask-cors, PyYAML. Edit and reload — no bundler.

There are no tests, no linter config, and no package manifest. Do not introduce them unless asked.

## Architecture

The dashboard is a thin web UI over **tmux sessions running a third-party agent CLI called "Hermes"**. It does not embed agents — it scrapes their terminal output.

**Data flow per poll (every 4s from the browser):**

1. Frontend `GET /api/status` → backend iterates the `AGENTS` dict (`backend/server.py:25`).
2. For each agent, backend runs `tmux capture-pane -t <session> -p -S -200`, strips ANSI, and parses the resulting lines.
3. Parser (`parse_capture`, `server.py:160`) recognizes three Hermes-specific structures:
   - `●` prefix → user message
   - `╭─ ⚕ Hermes ─...─╮` box → agent response (multi-line, word-wrapped inside; `_join_form_lines` reconstructs paragraphs by treating 4-space indent as a new paragraph and unindented lines as wrap continuations)
   - Lines starting with a tool emoji from `TOOL_EMOJIS` → tool call (attached to the *next* agent response)
4. Busy/idle is determined by whether the last non-separator line matches `<profile> ❯` (`is_busy`, `server.py:97`).
5. Parsed events are merged into an in-memory store (`_store`, guarded by `_store_lock`) that preserves timestamps across polls by fingerprinting `role + content[:80]` (`update_messages`, `server.py:235`). New events get `time.time()`; matched events keep their original timestamp.

**Writes back to agents:**

- `POST /api/agents/<key>/message` → `tmux send-keys -t <session> <text> Enter`. Also optimistically appends the user message to the store so the UI shows it before the next poll.
- `POST /api/agents/<key>/interrupt` → `tmux send-keys -t <session> C-c`.

**Adding an agent** = adding an entry to `AGENTS` in `server.py:25`. The `session` field must match a real, running tmux session; the `profile` field must match the prompt prefix that the Hermes CLI prints (used by `is_busy` and prompt detection in `get_status`). The frontend reads agents dynamically from `/api/status`, so no UI changes are needed.

## Things to know before changing the parser

- The parser is **format-coupled to Hermes' terminal UI**. The box-drawing chars (`╭ ╰ │ ─`), the `⚕` glyph in the status bar, the `●` user marker, the `<profile> ❯` prompt, and the tool emojis are all load-bearing. If Hermes changes its output, the parser breaks silently — `is_busy` and `parse_capture` will just stop recognizing things and the UI will show stale or empty conversations.
- Status-bar lines are filtered by checking for `⚕` *together with* one of `⏲ ░ K/ M/ ctx` — agent response boxes also contain `⚕` (in their header), so don't loosen that condition.
- `_ANSI_RE` (`server.py:69`) handles CSI, OSC, and single-char escapes. tmux capture without `-e` should already be mostly stripped, but Hermes emits some sequences that survive — keep the regex.
- The 200-line capture window (`-S -200`) caps how far back history is reconstructed. Older messages scroll off and disappear from the store on the next poll because `update_messages` rebuilds the list from the parsed events each time.

## Frontend notes

- Single file, no framework, no build. Vanilla JS with `fetch` + `setInterval(poll, 4000)` (`index.html:1173`).
- `sendMessage` does optimistic UI (`index.html:1109`) — adds the user message to local state before the POST returns, then calls `poll()` immediately after. Don't remove the optimistic insert without also speeding up the poll cadence.
- All styling lives in the `<style>` block at the top of `index.html` using CSS custom properties under `:root` / `[data-theme="dark"]`. Spanish UI strings ("conectado", "sin conexión") are inline in the JS.
