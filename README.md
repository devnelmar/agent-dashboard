# Agent Dashboard

A lightweight web dashboard for monitoring and messaging AI agents running in tmux sessions via the [Hermes](https://hermes.ai) CLI.

## What it does

- Polls each agent's tmux session every 4 seconds
- Parses Hermes terminal output (messages, tool calls, busy/idle state)
- Lets you send messages and interrupt agents from a browser UI
- No agent SDK embedded — it scrapes terminal output

## Requirements

- Python 3.10+
- [tmux](https://github.com/tmux/tmux)
- [Hermes CLI](https://hermes.ai) running in named tmux sessions
- A modern browser

## Setup

```bash
pip install -r requirements.txt
```

## Run

```bash
cd backend && python3 server.py
```

Dashboard available at http://127.0.0.1:9120.

## Adding an agent

Edit the `AGENTS` dict in `backend/server.py`:

```python
AGENTS = {
    "my-agent": {
        "name": "My Agent",
        "session": "my-tmux-session",   # must match a running tmux session
        "emoji": "🤖",
        "profile": "my-profile",        # must match the Hermes prompt prefix
        "project": "My Project",
    },
    ...
}
```

The frontend reads agents dynamically from `/api/status` — no UI changes needed.

## Architecture

Flask backend + vanilla JS frontend (no build step, no framework).

For a detailed breakdown of the parser, polling logic, and tmux integration see [CLAUDE.md](CLAUDE.md).
