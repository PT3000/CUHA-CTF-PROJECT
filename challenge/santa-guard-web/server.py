"""A locally hosted, staged Christmas CTF built with Flask and SQLite."""
from __future__ import annotations

import argparse
import json
import os
import re
import secrets
import sqlite3
import threading
import time
from functools import wraps
from pathlib import Path

from flask import Flask, abort, g, jsonify, redirect, render_template, request, send_file, url_for

from werkzeug.security import check_password_hash

from mindlogic import Gateway
from polyomino import LEVELS, is_complete, validate_layout
from puzzle import (
    ARCHIVE_ID, ARCHIVE_HASH, CIPHER_ALPHABET, EMPLOYEE_HASH, EMPLOYEE_ID, FLAG, FLAG_CIPHERTEXT, FLAG_PATTERN,
    HANDOFF_CLUES, HANDOFF_NOTES, MEMO, PLAIN_ALPHABET, RECORDS,
)


ROOT = Path(__file__).resolve().parent
COOKIE_NAME = "santa_visit"
SESSION_SECONDS = 4 * 3600
VISITOR, EMPLOYEE, ARCHIVE = range(3)
GREETING = "안녕하세요. 비밀 창고 야간 경비원 ELF-01입니다. 첫 근무를 앞두셨다면 실습 당직이나 인수인계 규칙을 물어보세요."
# Keep completed training answers out of both the chat transcript and the model input.
TRAINING_LOGIN = re.compile(
    rf"(?<![A-Za-z0-9_-])(?:{re.escape(EMPLOYEE_ID)}|[A-Za-z]{{8}}\s*_\s*12\s*25)(?![A-Za-z0-9_-])",
    re.IGNORECASE,
)
HANDOFF_MARKER = re.compile("|".join(map(re.escape, HANDOFF_CLUES)))
STAFF_PASSWORD = re.compile(r"ELF-[A-Za-z0-9_-]{16}(?![A-Za-z0-9_-])")
SCHEMA = """
CREATE TABLE IF NOT EXISTS staff_accounts (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    csrf TEXT NOT NULL,
    role INTEGER NOT NULL DEFAULT 0,
    expires INTEGER NOT NULL,
    staff_password_hash TEXT,
    staff_password_expires INTEGER,
    chat_epoch INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY,
    visit_id INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_by_visit ON chat_messages(visit_id, id);
CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY,
    visit_id INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_by_visit ON attempts(visit_id, event, created);
CREATE TABLE IF NOT EXISTS warehouse_games (
    visit_id INTEGER PRIMARY KEY REFERENCES visits(id) ON DELETE CASCADE,
    stage INTEGER NOT NULL,
    version INTEGER NOT NULL,
    layout TEXT NOT NULL
);
"""


def create_app(database=None, gateway=None):
    app = Flask(__name__, template_folder="templates", static_folder="web", static_url_path="/static")
    app.config["MAX_CONTENT_LENGTH"] = 8192
    database = Path(database or os.environ.get("SANTA_DB_PATH") or ROOT / "data" / "workshop.sqlite3")
    database.parent.mkdir(parents=True, exist_ok=True)
    gateway = gateway if gateway is not None else Gateway(ROOT / ".env")
    archive_hash = ARCHIVE_HASH.read_text(encoding="ascii").strip()
    chat_lock = threading.Lock()
    pending = set()
    gateway_calls = 0

    def connect():
        db = sqlite3.connect(database, timeout=8)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")
        return db

    with connect() as startup:
        startup.execute("PRAGMA journal_mode = WAL")
        startup.executescript(SCHEMA)
        startup.execute("BEGIN IMMEDIATE")
        startup.execute(
            "INSERT INTO staff_accounts (username, password_hash) VALUES (?, ?) "
            "ON CONFLICT(username) DO NOTHING",
            (EMPLOYEE_ID, EMPLOYEE_HASH.read_text(encoding="ascii").strip()),
        )
        columns = {column["name"] for column in startup.execute("PRAGMA table_info(visits)")}
        if "code" in columns:
            startup.execute("ALTER TABLE visits RENAME COLUMN code TO staff_password_hash")
            startup.execute("ALTER TABLE visits RENAME COLUMN code_expires TO staff_password_expires")
            startup.execute("UPDATE visits SET staff_password_hash = NULL, staff_password_expires = NULL")
    startup.close()

    def db():
        if "db" not in g:
            g.db = connect()
        return g.db

    @app.teardown_appcontext
    def close_db(_error):
        connection = g.pop("db", None)
        if connection is not None:
            connection.close()

    def new_visit():
        now = int(time.time())
        token = secrets.token_urlsafe(32)
        csrf = secrets.token_urlsafe(24)
        connection = db()
        with connection:
            connection.execute("DELETE FROM visits WHERE expires <= ?", (now,))
            cursor = connection.execute(
                "INSERT INTO visits (token, csrf, expires) VALUES (?, ?, ?)",
                (token, csrf, now + SESSION_SECONDS),
            )
        g.new_token = token
        return connection.execute("SELECT * FROM visits WHERE id = ?", (cursor.lastrowid,)).fetchone()

    @app.before_request
    def load_visit():
        if request.endpoint == "static" or request.endpoint is None:
            return
        token = request.cookies.get(COOKIE_NAME, "")
        g.visit = db().execute(
            "SELECT * FROM visits WHERE token = ? AND expires > ?", (token, int(time.time()))
        ).fetchone() if re.fullmatch(r"[A-Za-z0-9_-]{43}", token) else None
        if g.visit is None:
            g.visit = new_visit()
        if request.method == "POST":
            supplied = request.headers.get("X-CSRF-Token", "") if request.is_json else request.form.get("_csrf", "")
            if not supplied or not supplied.isascii() or not secrets.compare_digest(supplied, g.visit["csrf"]):
                if request.path.startswith("/api/"):
                    return jsonify(message="페이지를 새로고침한 뒤 다시 시도해 주세요."), 403
                abort(403, "페이지를 새로고침한 뒤 다시 시도해 주세요.")

    @app.after_request
    def response_policy(response):
        if request.endpoint != "static":
            response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
        )
        if g.get("new_token"):
            response.set_cookie(COOKIE_NAME, g.new_token, max_age=SESSION_SECONDS, httponly=True,
                                samesite="Strict", secure=request.is_secure, path="/")
        return response

    @app.context_processor
    def page_context():
        visit = g.get("visit")
        return dict(role=visit["role"] if visit else VISITOR, csrf=visit["csrf"] if visit else "")

    def access(min_role):
        def decorate(function):
            @wraps(function)
            def check(*args, **kwargs):
                role = g.visit["role"]
                if role < min_role:
                    if request.path.startswith("/api/"):
                        return jsonify(message="이 기능을 사용하려면 자료실에 로그인하세요."), 403
                    return redirect(url_for("login" if role == VISITOR else "admin_login"))
                return function(*args, **kwargs)
            return check
        return decorate

    def rotate_role(role):
        token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(24)
        with db() as conn:
            changed = conn.execute(
                """
                UPDATE visits SET token = ?, csrf = ?, role = ?, expires = ?,
                    staff_password_hash = NULL, staff_password_expires = NULL
                WHERE id = ? AND token = ? AND role = ? AND staff_password_hash IS ?
                """,
                (token, csrf, role, int(time.time()) + SESSION_SECONDS,
                 g.visit["id"], g.visit["token"], g.visit["role"], g.visit["staff_password_hash"]),
            )
            if changed.rowcount != 1:
                abort(409, "다른 창에서 진행 상태가 바뀌었습니다. 새로고침하세요.")
        g.new_token = token

    def allow_attempt(event, *, limit, period):
        now = int(time.time())
        visit_id = g.visit["id"]
        with db() as conn:
            conn.execute("DELETE FROM attempts WHERE visit_id = ? AND event = ? AND created <= ?",
                         (visit_id, event, now - period))
            count = conn.execute(
                "SELECT COUNT(*) FROM attempts WHERE visit_id = ? AND event = ?", (visit_id, event)
            ).fetchone()[0]
            if count >= limit:
                return False
            conn.execute("INSERT INTO attempts (visit_id, event, created) VALUES (?, ?, ?)", (visit_id, event, now))
        return True

    def json_body():
        value = request.get_json(silent=True)
        return value if isinstance(value, dict) else {}

    def history():
        turns = db().execute(
            "SELECT role, text FROM chat_messages WHERE visit_id = ? ORDER BY id DESC LIMIT 10",
            (g.visit["id"],),
        ).fetchall()
        return [
            {"role": turn["role"], "text": TRAINING_LOGIN.sub("[실습 로그인 정보]", turn["text"])}
            for turn in reversed(turns)
        ] or [{"role": "guard", "text": GREETING}]

    def chat_response():
        messages = history()
        for message in messages:
            if message["role"] == "guard":
                message["text"] = HANDOFF_MARKER.sub(lambda marker: HANDOFF_CLUES[marker[0]], message["text"])
        return jsonify(messages=messages)

    @app.get("/")
    def index():
        return redirect(url_for({VISITOR: "login", EMPLOYEE: "employee", ARCHIVE: "warehouse"}[g.visit["role"]]))

    @app.route("/login", methods=["GET", "POST"])
    def login():
        if g.visit["role"] >= EMPLOYEE:
            return redirect(url_for("employee"))
        error = ""
        if request.method == "POST":
            if not allow_attempt("staff-login", limit=8, period=60):
                error = "로그인 시도가 많습니다. 1분 뒤에 다시 시도해 주세요."
            else:
                user = request.form.get("employee_id", "").strip().lower()
                password = request.form.get("password", "")
                row = db().execute("SELECT password_hash FROM staff_accounts WHERE username = ?", (user,)).fetchone()
                if row and 1 <= len(password) <= 128 and check_password_hash(row["password_hash"], password):
                    rotate_role(EMPLOYEE)
                    return redirect(url_for("employee"))
                error = "직원 아이디와 비밀번호를 확인하세요. ELF-01에게 실습 당직을 물어볼 수 있습니다."
        return render_template("login.html", error=error)

    @app.get("/api/chat")
    def chat_history():
        return chat_response()

    @app.post("/api/chat")
    def chat():
        nonlocal gateway_calls
        question = json_body().get("text")
        if not isinstance(question, str) or not 1 <= len(question.strip()) <= 1000:
            return jsonify(message="질문은 1,000자 이내로 입력해 주세요."), 400
        if not allow_attempt("chat", limit=5, period=60):
            return jsonify(message="경비원에게는 1분에 최대 5번 질문할 수 있어요."), 429
        question = STAFF_PASSWORD.sub("[비밀번호]", question.strip())
        question = TRAINING_LOGIN.sub("[실습 로그인 추측]", question)
        visit_id = g.visit["id"]
        with chat_lock:
            if visit_id in pending:
                return jsonify(message="앞선 답변이 도착하면 다시 질문해 주세요."), 409
            if not gateway.enabled or gateway_calls >= gateway.max_calls:
                return jsonify(
                    message="지금 ELF-01과 대화할 수 없어요. 인수인계 수첩에서 단서를 확인해 주세요.",
                    handoff_notes=HANDOFF_NOTES,
                ), 503
            pending.add(visit_id)
            gateway_calls += 1

        try:
            reply = gateway.reply(history(), question)
            if not reply:
                return jsonify(
                    message="ELF-01이 응답하지 않았어요. 인수인계 수첩에서 단서를 확인해 주세요.",
                    handoff_notes=HANDOFF_NOTES,
                ), 502
            if TRAINING_LOGIN.search(reply):
                reply = "\n".join(("직원 로그인 정보는 바로 알려 드릴 수 없어요. 수첩의 단서를 참고해 주세요.", *HANDOFF_CLUES))
            with db() as conn:
                conn.executemany(
                    """
                    INSERT INTO chat_messages (visit_id, role, text)
                    SELECT id, ?, ? FROM visits WHERE id = ? AND chat_epoch = ?
                    """,
                    [(role, text, visit_id, g.visit["chat_epoch"])
                     for role, text in (("visitor", question), ("guard", reply))],
                )
                conn.execute(
                    """DELETE FROM chat_messages WHERE visit_id = ? AND id NOT IN
                       (SELECT id FROM chat_messages WHERE visit_id = ? ORDER BY id DESC LIMIT 10)""",
                    (visit_id, visit_id),
                )
        finally:
            with chat_lock:
                pending.discard(visit_id)
        return chat_response()

    @app.post("/api/chat/reset")
    def reset_chat():
        with db() as conn:
            conn.execute("UPDATE visits SET chat_epoch = chat_epoch + 1 WHERE id = ?", (g.visit["id"],))
            conn.execute("DELETE FROM chat_messages WHERE visit_id = ?", (g.visit["id"],))
        return chat_response()

    @app.get("/employee")
    @access(EMPLOYEE)
    def employee():
        return render_template("employee.html")

    @app.get("/employee/notice")
    @access(EMPLOYEE)
    def employee_notice():
        return render_template("notice.html")

    @app.get("/employee/memo")
    @access(EMPLOYEE)
    def employee_memo():
        return redirect(url_for("admin_login"))

    @app.get("/employee/delivery")
    @access(EMPLOYEE)
    def employee_delivery():
        return render_template("delivery.html", records=RECORDS)

    @app.get("/employee/inventory")
    @access(EMPLOYEE)
    def employee_inventory():
        return render_template("inventory.html")

    @app.get("/employee/memo/original.png")
    @access(EMPLOYEE)
    def memo_file():
        return send_file(MEMO, mimetype="image/png", download_name="archive_memo.png",
                         as_attachment=request.args.get("download") == "1")

    @app.route("/admin/login", methods=["GET", "POST"])
    @access(EMPLOYEE)
    def admin_login():
        if g.visit["role"] == ARCHIVE:
            return redirect(url_for("warehouse"))
        error = ""
        if request.method == "POST":
            user = request.form.get("admin_id", "").strip().lower()
            password = request.form.get("password", "")
            if not allow_attempt("archive-login", limit=8, period=60):
                error = "로그인 시도가 많습니다. 1분 뒤에 다시 시도해 주세요."
            elif user == ARCHIVE_ID and 1 <= len(password) <= 128 and check_password_hash(archive_hash, password):
                rotate_role(ARCHIVE)
                return redirect(url_for("warehouse"))
            else:
                error = "관리자 아이디 또는 비밀번호가 일치하지 않습니다."
        return render_template("admin_login.html", error=error)

    def active_warehouse_game():
        row = db().execute(
            "SELECT stage, version, layout FROM warehouse_games WHERE visit_id = ?", (g.visit["id"],)
        ).fetchone()
        stage = row["stage"] if row else 1
        if stage > len(LEVELS):
            return None
        return {
            **LEVELS[stage - 1], "stage": stage,
            "version": row["version"] if row else 0,
            "layout": json.loads(row["layout"]) if row else {},
        }

    @app.get("/admin")
    @access(ARCHIVE)
    def admin():
        return redirect(url_for("warehouse"))

    @app.route("/admin/warehouse", methods=["GET", "POST"])
    @access(ARCHIVE)
    def warehouse():
        if request.method == "GET":
            game = active_warehouse_game()
            if game is None:
                return redirect(url_for("admin_files"))
            return render_template("warehouse.html", game=game)

        if not request.is_json:
            return jsonify(message="퍼즐 화면을 새로고침해 주세요."), 415
        move = json_body()
        if type(move.get("stage")) is not int or type(move.get("version")) is not int:
            return jsonify(message="퍼즐 단계 또는 진행 정보가 올바르지 않습니다."), 422

        # Compare and save inside one transaction so competing tabs cannot overwrite a move.
        with db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            valid_session = conn.execute(
                "SELECT 1 FROM visits WHERE id = ? AND token = ? AND role = ? AND expires > ?",
                (g.visit["id"], g.visit["token"], ARCHIVE, int(time.time())),
            ).fetchone()
            if not valid_session:
                return jsonify(message="세션이 종료됐습니다. 다시 로그인해 주세요."), 403
            game = active_warehouse_game()
            if game is None:
                return jsonify(reward=url_for("admin_files"))
            stage, version = game["stage"], game["version"]
            if move["stage"] != stage or move["version"] != version:
                return jsonify(message="다른 창에서 변경한 최신 배치를 불러왔습니다.", game=game), 409
            layout = move.get("layout")
            level = LEVELS[stage - 1]
            if not validate_layout(level, layout):
                return jsonify(message="블록이 겹치거나 창고 밖에 놓였습니다. 빈칸을 확인하세요."), 422
            if layout == game["layout"]:
                return jsonify(game=game)
            if is_complete(level, layout):
                stage += 1
                layout = {}

            conn.execute(
                """
                INSERT INTO warehouse_games (visit_id, stage, version, layout) VALUES (?, ?, ?, ?)
                ON CONFLICT(visit_id) DO UPDATE SET
                    stage = excluded.stage, version = excluded.version, layout = excluded.layout
                """,
                (g.visit["id"], stage, version + 1, json.dumps(layout, separators=(",", ":"))),
            )
            next_game = active_warehouse_game()
        if next_game is None:
            return jsonify(reward=url_for("admin_files"))
        return jsonify(game=next_game)

    @app.get("/admin/files")
    @access(ARCHIVE)
    def admin_files():
        if active_warehouse_game() is not None:
            return redirect(url_for("warehouse"))
        return render_template(
            "files.html", ciphertext=FLAG_CIPHERTEXT, plain_alphabet=PLAIN_ALPHABET,
            cipher_alphabet=CIPHER_ALPHABET,
        )

    @app.post("/api/flag")
    @access(ARCHIVE)
    def verify_flag():
        if active_warehouse_game() is not None:
            return jsonify(message="창고 퍼즐 4단계를 마친 뒤 플래그를 확인할 수 있습니다."), 403
        value = json_body().get("flag")
        if not isinstance(value, str) or not FLAG_PATTERN.fullmatch(value.strip()):
            return jsonify(message="xmas{...} 형식으로 입력해 주세요."), 422
        if not secrets.compare_digest(value.strip(), FLAG):
            return jsonify(message="플래그가 일치하지 않습니다. 치환표의 방향과 대소문자를 확인하세요."), 422
        return jsonify(message="플래그가 맞습니다.")

    @app.post("/logout")
    def logout():
        with db() as conn:
            conn.execute("DELETE FROM visits WHERE id = ?", (g.visit["id"],))
        response = redirect(url_for("login"))
        response.delete_cookie(COOKIE_NAME, path="/")
        return response

    @app.cli.command("set-staff-password")
    def set_staff_password():
        """Configure the local game employee account."""
        import click
        from werkzeug.security import generate_password_hash

        password = click.prompt("직원 계정 비밀번호", hide_input=True, confirmation_prompt=True)
        if not 12 <= len(password) <= 128:
            raise click.ClickException("12~128자를 입력하세요.")
        with db() as conn:
            conn.execute(
                "INSERT INTO staff_accounts(username,password_hash) VALUES (?,?) "
                "ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash",
                (EMPLOYEE_ID, generate_password_hash(password)),
            )
        click.echo("직원 계정이 설정되었습니다.")

    return app


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8008)
    args = parser.parse_args()
    create_app().run(host=args.host, port=args.port, debug=False)
