#!/usr/bin/env python3
"""
图测记录工具 - 后端服务
依赖: pip install flask flask-cors
启动: python server.py
"""
import sys, os, json, uuid, sqlite3, hmac, hashlib, base64, time, secrets
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory, g
from flask_cors import CORS

# ── 配置 ──────────────────────────────────────────────────────
if getattr(sys, 'frozen', False):
    # PyInstaller 打包后：静态文件在临时解压目录，数据库放在 exe 同级目录
    BUNDLE_DIR = sys._MEIPASS
    BASE_DIR   = os.path.dirname(sys.executable)
else:
    BUNDLE_DIR = os.path.dirname(os.path.abspath(__file__))
    BASE_DIR   = BUNDLE_DIR

DATA_DIR = os.path.join(BASE_DIR, 'data')
DB_PATH  = os.path.join(DATA_DIR, 'db.sqlite')
SECRET   = os.environ.get('SECRET_KEY', 'change-me-in-production')
PORT     = int(os.environ.get('PORT', 5000))

app = Flask(__name__, static_folder=os.path.join(BUNDLE_DIR, 'public'), static_url_path='')
CORS(app)

# ── 数据库 ────────────────────────────────────────────────────
def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute('PRAGMA journal_mode=WAL')
    return g.db

@app.teardown_appcontext
def close_db(_=None):
    db = g.pop('db', None)
    if db: db.close()

def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id          TEXT PRIMARY KEY,
            email       TEXT UNIQUE NOT NULL,
            name        TEXT NOT NULL,
            pwd_hash    TEXT NOT NULL,
            is_admin    INTEGER DEFAULT 0,
            approved    INTEGER DEFAULT 1,
            joined_at   TEXT
        );
        CREATE TABLE IF NOT EXISTS tests (
            id          TEXT PRIMARY KEY,
            data        TEXT NOT NULL,
            created_at  TEXT,
            updated_at  TEXT
        );
        CREATE TABLE IF NOT EXISTS projects (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            created_at  TEXT
        );
        CREATE TABLE IF NOT EXISTS settings (
            key         TEXT PRIMARY KEY,
            value       TEXT
        );
    ''')
    conn.commit()
    conn.close()

# ── 密码 & JWT（只用 Python 标准库）────────────────────────────
def hash_pwd(password):
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 260000)
    return f'{salt}:{h.hex()}'

def check_pwd(password, stored):
    salt, h = stored.split(':')
    test = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 260000)
    return hmac.compare_digest(test.hex(), h)

def _b64(data):
    if isinstance(data, str): data = data.encode()
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

def _unb64(s):
    return base64.urlsafe_b64decode(s + '==')

def make_token(user_id):
    header  = _b64(b'{"alg":"HS256","typ":"JWT"}')
    payload = _b64(json.dumps({'sub': user_id, 'exp': int(time.time()) + 86400 * 30}).encode())
    msg = f'{header}.{payload}'
    sig = _b64(hmac.new(SECRET.encode(), msg.encode(), hashlib.sha256).digest())
    return f'{msg}.{sig}'

def verify_token(token):
    try:
        h, p, s = token.split('.')
        msg = f'{h}.{p}'
        expected = _b64(hmac.new(SECRET.encode(), msg.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(s, expected): return None
        payload = json.loads(_unb64(p))
        if payload.get('exp', 0) < time.time(): return None
        return payload
    except Exception:
        return None

def require_auth(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        token = auth.removeprefix('Bearer ').strip()
        payload = verify_token(token)
        if not payload: return jsonify({'error': 'Unauthorized'}), 401
        db = get_db()
        row = db.execute('SELECT * FROM users WHERE id=?', (payload['sub'],)).fetchone()
        if not row: return jsonify({'error': 'Unauthorized'}), 401
        g.current_user = dict(row)
        return f(*args, **kwargs)
    return wrapper

def require_admin(f):
    @wraps(f)
    @require_auth
    def wrapper(*args, **kwargs):
        if not g.current_user.get('is_admin'):
            return jsonify({'error': 'Forbidden'}), 403
        return f(*args, **kwargs)
    return wrapper

# ── 工具 ──────────────────────────────────────────────────────
def now_iso():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()

def user_to_dict(row):
    d = dict(row)
    d.pop('pwd_hash', None)
    d['isAdmin']   = bool(d.pop('is_admin', 0))
    d['approved']  = bool(d.get('approved', 1))
    d['joinedAt']  = d.pop('joined_at', None)
    return d

# ── 认证接口 ──────────────────────────────────────────────────
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    if not email or not password:
        return jsonify({'error': '请输入邮箱和密码'}), 400
    db = get_db()
    row = db.execute('SELECT * FROM users WHERE email=?', (email,)).fetchone()
    if not row or not check_pwd(password, row['pwd_hash']):
        return jsonify({'error': '邮箱或密码错误'}), 401
    if not row['approved']:
        return jsonify({'error': '账号待审批'}), 403
    return jsonify({'token': make_token(row['id']), 'user': user_to_dict(row)})

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    email    = (data.get('email') or '').strip().lower()
    name     = (data.get('name') or '').strip()
    password = data.get('password') or ''
    code     = (data.get('accessCode') or '').strip()
    if not all([email, name, password, code]):
        return jsonify({'error': '请填写所有字段'}), 400
    db = get_db()
    settings_row = db.execute("SELECT value FROM settings WHERE key='main'").fetchone()
    settings = json.loads(settings_row['value']) if settings_row else {}
    if code != settings.get('accessCode', 'sanyi'):
        return jsonify({'error': '入场码错误'}), 403
    if db.execute('SELECT 1 FROM users WHERE email=?', (email,)).fetchone():
        return jsonify({'error': '该邮箱已注册'}), 409
    is_first = not db.execute('SELECT 1 FROM users').fetchone()
    uid = str(uuid.uuid4())
    db.execute(
        'INSERT INTO users (id,email,name,pwd_hash,is_admin,approved,joined_at) VALUES (?,?,?,?,?,?,?)',
        (uid, email, name, hash_pwd(password), 1 if is_first else 0, 1, now_iso())
    )
    db.commit()
    row = db.execute('SELECT * FROM users WHERE id=?', (uid,)).fetchone()
    return jsonify({'token': make_token(uid), 'user': user_to_dict(row)}), 201

@app.route('/api/auth/me')
@require_auth
def me():
    return jsonify({'user': user_to_dict(get_db().execute('SELECT * FROM users WHERE id=?', (g.current_user['id'],)).fetchone())})

# ── 设置 ──────────────────────────────────────────────────────
@app.route('/api/settings', methods=['GET'])
@require_auth
def get_settings():
    row = get_db().execute("SELECT value FROM settings WHERE key='main'").fetchone()
    return jsonify(json.loads(row['value']) if row else {})

@app.route('/api/settings', methods=['PUT'])
@require_auth
def put_settings():
    data = request.get_json() or {}
    db = get_db()
    existing_row = db.execute("SELECT value FROM settings WHERE key='main'").fetchone()
    if existing_row:
        existing = json.loads(existing_row['value'])
        existing.update(data)
        db.execute("UPDATE settings SET value=? WHERE key='main'", (json.dumps(existing),))
    else:
        db.execute("INSERT INTO settings (key,value) VALUES ('main',?)", (json.dumps(data),))
    db.commit()
    return jsonify({'ok': True})

# ── 用户 ──────────────────────────────────────────────────────
@app.route('/api/users', methods=['GET'])
@require_admin
def list_users():
    rows = get_db().execute('SELECT * FROM users ORDER BY joined_at').fetchall()
    return jsonify([user_to_dict(r) for r in rows])

@app.route('/api/users/<uid>', methods=['GET'])
@require_auth
def get_user(uid):
    if uid != g.current_user['id'] and not g.current_user.get('is_admin'):
        return jsonify({'error': 'Forbidden'}), 403
    row = get_db().execute('SELECT * FROM users WHERE id=?', (uid,)).fetchone()
    if not row: return jsonify({'error': 'Not found'}), 404
    return jsonify(user_to_dict(row))

@app.route('/api/users/<uid>', methods=['PATCH'])
@require_admin
def patch_user(uid):
    data = request.get_json() or {}
    db = get_db()
    allowed = {'name', 'is_admin', 'approved', 'isAdmin'}
    updates = {}
    if 'isAdmin' in data: updates['is_admin'] = 1 if data['isAdmin'] else 0
    if 'is_admin' in data: updates['is_admin'] = 1 if data['is_admin'] else 0
    if 'approved' in data: updates['approved'] = 1 if data['approved'] else 0
    if 'name' in data: updates['name'] = data['name']
    if not updates: return jsonify({'ok': True})
    cols = ', '.join(f'{k}=?' for k in updates)
    db.execute(f'UPDATE users SET {cols} WHERE id=?', (*updates.values(), uid))
    db.commit()
    return jsonify({'ok': True})

@app.route('/api/users/<uid>', methods=['DELETE'])
@require_admin
def delete_user(uid):
    if uid == g.current_user['id']:
        return jsonify({'error': '不能删除自己'}), 400
    db = get_db()
    db.execute('DELETE FROM users WHERE id=?', (uid,))
    db.commit()
    return jsonify({'ok': True})

# ── 项目 ──────────────────────────────────────────────────────
@app.route('/api/projects', methods=['GET'])
@require_auth
def list_projects():
    rows = get_db().execute('SELECT * FROM projects ORDER BY name').fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/api/projects', methods=['POST'])
@require_auth
def add_project():
    name = (request.get_json() or {}).get('name', '').strip()
    if not name: return jsonify({'error': '名称不能为空'}), 400
    pid = str(uuid.uuid4())
    db = get_db()
    db.execute('INSERT INTO projects (id,name,created_at) VALUES (?,?,?)', (pid, name, now_iso()))
    db.commit()
    return jsonify({'id': pid, 'name': name}), 201

@app.route('/api/projects/<pid>', methods=['DELETE'])
@require_auth
def delete_project(pid):
    db = get_db()
    db.execute('DELETE FROM projects WHERE id=?', (pid,))
    db.commit()
    return jsonify({'ok': True})

# ── 测试记录 ──────────────────────────────────────────────────
@app.route('/api/tests', methods=['GET'])
@require_auth
def list_tests():
    rows = get_db().execute('SELECT id, data, created_at, updated_at FROM tests ORDER BY created_at DESC').fetchall()
    result = []
    for r in rows:
        try:
            d = json.loads(r['data'])
            d['id'] = r['id']
            result.append(d)
        except Exception:
            pass
    return jsonify(result)

@app.route('/api/tests', methods=['POST'])
@require_auth
def create_test():
    data = request.get_json() or {}
    tid = str(uuid.uuid4())
    data.pop('id', None)
    db = get_db()
    db.execute('INSERT INTO tests (id,data,created_at,updated_at) VALUES (?,?,?,?)',
               (tid, json.dumps(data), now_iso(), now_iso()))
    db.commit()
    return jsonify({'id': tid}), 201

@app.route('/api/tests/<tid>', methods=['PATCH'])
@require_auth
def update_test(tid):
    updates = request.get_json() or {}
    db = get_db()
    row = db.execute('SELECT data FROM tests WHERE id=?', (tid,)).fetchone()
    if not row: return jsonify({'error': 'Not found'}), 404
    existing = json.loads(row['data'])
    existing.update(updates)
    existing.pop('id', None)
    db.execute('UPDATE tests SET data=?, updated_at=? WHERE id=?',
               (json.dumps(existing), now_iso(), tid))
    db.commit()
    return jsonify({'ok': True})

@app.route('/api/tests/<tid>', methods=['DELETE'])
@require_auth
def delete_test(tid):
    db = get_db()
    db.execute('DELETE FROM tests WHERE id=?', (tid,))
    db.commit()
    return jsonify({'ok': True})

# ── 静态文件（前端）─────────────────────────────────────────
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_static(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

# ── 启动 ──────────────────────────────────────────────────────
if __name__ == '__main__':
    init_db()
    print(f'✅ 服务启动: http://0.0.0.0:{PORT}')
    print(f'📁 数据目录: {DATA_DIR}')
    app.run(host='0.0.0.0', port=PORT, debug=False)
