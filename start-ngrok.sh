#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# PID yang benar-benar milik proyek ini (dicek lewat cwd), supaya tidak
# membunuh proses milik proyek lain yang kebetulan namanya sama.
project_pids() {
    local pid cwd
    for pid in $(pgrep -f "$1" 2>/dev/null || true); do
        cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')
        case "$cwd" in
            "$PROJECT_DIR"*) printf '%s ' "$pid" ;;
        esac
    done
}

# Matikan sisa proses dari run sebelumnya (SIGTERM dulu, SIGKILL kalau bandel).
kill_stale() {
    local pids waited
    pids=$(project_pids "$1")
    if [ -z "$pids" ]; then return 0; fi
    for pid in $pids; do kill -TERM "$pid" 2>/dev/null || true; done
    waited=0
    while [ "$waited" -lt 5 ]; do
        pids=$(project_pids "$1")
        if [ -z "$pids" ]; then return 0; fi
        sleep 1
        waited=$((waited + 1))
    done
    for pid in $pids; do kill -KILL "$pid" 2>/dev/null || true; done
    return 0
}

port_pids() {
    lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null || true
}

# Tunggu sampai URL beneran balas 200 (bukan cuma cek PID — proses bisa
# hidup tapi app-nya gagal boot).
wait_for_http() {
    local url="$1" pid="$2" tries="${3:-40}" i code
    for ((i = 1; i <= tries; i++)); do
        if ! kill -0 "$pid" 2>/dev/null; then return 1; fi
        code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$url" || true)
        if [ "$code" = "200" ]; then return 0; fi
        sleep 1
    done
    return 1
}

tail_log() {
    echo -e "      ${YELLOW}Log terakhir:${NC}"
    tail -15 "$1" 2>/dev/null | sed 's/^/      /' || true
}

cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping all services...${NC}"
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
    kill_stale "uvicorn app.main:app"
    kill_stale "vite"
    pkill -f "ngrok" 2>/dev/null || true
    echo -e "${GREEN}All stopped.${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║  Finora - Ngrok Tunnel                  ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Backend ───────────────────────────────────────
echo -e "${YELLOW}[Backend]${NC} Membersihkan proses lama..."
kill_stale "uvicorn app.main:app"
kill_stale "vite"
pkill -f "ngrok http" 2>/dev/null || true
sleep 1

# Cari port yang benar-benar bebas (8000 bisa saja dipakai proyek lain).
BACKEND_PORT=""
for p in 8000 8001 8002 8003 8004 8005; do
    if [ -z "$(port_pids "$p")" ]; then
        BACKEND_PORT=$p
        break
    fi
done

if [ -z "$BACKEND_PORT" ]; then
    echo -e "      ${RED}✗${NC} Port 8000-8005 semua terpakai. Cek: lsof -nP -iTCP:8000-8005 -sTCP:LISTEN"
    exit 1
fi

if [ "$BACKEND_PORT" != "8000" ]; then
    HOLDER_PID=$(port_pids 8000 | head -1)
    HOLDER_CMD=$(ps -p "$HOLDER_PID" -o command= 2>/dev/null || true)
    echo -e "      ${YELLOW}!${NC} Port 8000 dipakai${HOLDER_CMD:+: ${HOLDER_CMD:0:80}} → backend pakai :${BACKEND_PORT}"
fi

if [ ! -d "$PROJECT_DIR/backend/venv" ]; then
    echo -e "      ${RED}✗${NC} backend/venv tidak ada. Jalankan dulu: python3 -m venv backend/venv && backend/venv/bin/pip install -r backend/requirements.txt"
    exit 1
fi

echo -e "${YELLOW}[Backend]${NC} Starting uvicorn on port ${BACKEND_PORT}..."
cd "$PROJECT_DIR/backend"
source venv/bin/activate
uvicorn app.main:app --reload --host 127.0.0.1 --port "$BACKEND_PORT" >/tmp/accounting-backend.log 2>&1 &
BACKEND_PID=$!

if wait_for_http "http://127.0.0.1:$BACKEND_PORT/health" "$BACKEND_PID" 40; then
    echo -e "      ${GREEN}✓${NC} Backend running — ${CYAN}http://localhost:$BACKEND_PORT${NC}"
else
    echo -e "      ${RED}✗${NC} Backend gagal."
    tail_log /tmp/accounting-backend.log
    exit 1
fi

# ── Frontend ──────────────────────────────────────
echo -e "${YELLOW}[Frontend]${NC} Starting Vite..."
cd "$PROJECT_DIR/frontend"
# Vite proxy ikut ke port backend yang tadi dipilih.
VITE_BACKEND_PORT="$BACKEND_PORT" npm run dev >/tmp/accounting-frontend.log 2>&1 &
FRONTEND_PID=$!

if wait_for_http "http://localhost:5173/" "$FRONTEND_PID" 30; then
    echo -e "      ${GREEN}✓${NC} Frontend running — ${CYAN}http://localhost:5173${NC}"
else
    echo -e "      ${RED}✗${NC} Frontend gagal."
    tail_log /tmp/accounting-frontend.log
    exit 1
fi

# ── Ngrok Tunnel ──────────────────────────────────
echo -e "${YELLOW}[Tunnel]${NC} Starting ngrok..."
ngrok http 5173 --log=stdout --log-format=logfmt >/tmp/accounting-tunnel.log 2>&1 &
TUNNEL_PID=$!

TUNNEL_URL=""
for i in {1..15}; do
    TUNNEL_URL=$(grep -oE "https://[a-z0-9-]+\.ngrok(-free)?\.(app|io|dev)" /tmp/accounting-tunnel.log 2>/dev/null | head -1)
    if [ -z "$TUNNEL_URL" ]; then
        TUNNEL_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -oE "https://[a-z0-9-]+\.ngrok(-free)?\.(app|io|dev)" | head -1)
    fi
    if [ -n "$TUNNEL_URL" ]; then break; fi
    sleep 2
done

# ── Done ──────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║            Semua Sudah Ready!            ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Local:${NC}"
echo -e "  • Frontend : ${CYAN}http://localhost:5173${NC}"
echo -e "  • Backend  : ${CYAN}http://localhost:$BACKEND_PORT${NC}"
echo -e "  • Swagger  : ${CYAN}http://localhost:$BACKEND_PORT/docs${NC}"
echo ""
if [ -n "$TUNNEL_URL" ]; then
    echo -e "  ${BOLD}${GREEN}Public URL (Ngrok):${NC}"
    echo -e "  ${BOLD}${CYAN}$TUNNEL_URL${NC}"
    echo ""
    echo -e "  ${YELLOW}Note:${NC}"
    echo -e "  - Muncul warning page (klik Visit Site) karena akun ngrok free"
    echo -e "  - URL berubah setiap restart (kecuali pakai domain static)"
    echo ""
fi
echo -e "  ${YELLOW}Logs:${NC}"
echo -e "  • backend:   tail -f /tmp/accounting-backend.log"
echo -e "  • frontend:  tail -f /tmp/accounting-frontend.log"
echo -e "  • tunnel:    tail -f /tmp/accounting-tunnel.log"
echo ""
echo -e "  ${RED}To stop: Ctrl+C${NC}"
echo ""

wait
