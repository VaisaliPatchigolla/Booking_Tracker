def user_exists():
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT id FROM users LIMIT 1')
    exists = c.fetchone() is not None
    conn.close()
    return exists


from flask import Flask, jsonify, request, send_from_directory, render_template, redirect, url_for, session, flash
from flask_cors import CORS
from datetime import datetime
import json

from database import get_db, init_db
from auth import signup, login, logout


app = Flask(__name__, static_folder='static', static_url_path='/static', template_folder='templates')
app.secret_key = 'your_secret_key_here'
CORS(app)

# Register auth routes
app.add_url_rule('/signup', 'signup', signup, methods=['GET','POST'])
app.add_url_rule('/login', 'login', login, methods=['GET','POST'])
app.add_url_rule('/logout', 'logout', logout)


from functools import wraps

# Login required decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):

        if not user_exists():
            return redirect(url_for('signup'))

        if 'user_id' not in session:
            return redirect(url_for('login'))

        return f(*args, **kwargs)

    return decorated_function


# ---------------- PAGE ROUTES ----------------

@app.route('/')
@login_required
def serve_home():
    return send_from_directory('templates', 'dashboard.html')


@app.route('/add')
@login_required
def serve_add():
    return send_from_directory('templates', 'index.html')


@app.route('/edit/<int:travel_id>')
@login_required
def serve_edit(travel_id):
    return send_from_directory('templates', 'edit.html')


@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)


# ---------------- API ROUTES ----------------

@app.route('/api/travels', methods=['GET'])
def get_travels():

    conn = get_db()
    c = conn.cursor()

    # Get filters from frontend
    search = request.args.get("search")
    status = request.args.get("status")
    sort = request.args.get("sort")

    # Accept both snake_case and camelCase query params for compatibility
    from_location = request.args.get("from_location") or request.args.get("fromLocation")
    to_location = request.args.get("to_location") or request.args.get("toLocation")

    query = "SELECT * FROM travels WHERE 1=1"
    params = []

    # From Location filter
    if from_location:
        query += " AND from_location = ?"
        params.append(from_location)

    # To Location filter
    if to_location:
        query += " AND to_location = ?"
        params.append(to_location)

    # Search filter
    if search:
        query += " AND (from_location LIKE ? OR to_location LIKE ? OR notes LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])

    # Status filter
    if status and status != "all":
        query += " AND status = ?"
        params.append(status)

    # Sorting
    if sort == "budget":
        query += " ORDER BY budget DESC"
    else:
        query += " ORDER BY travel_date ASC"

    c.execute(query, params)

    travels = [dict(row) for row in c.fetchall()]
    conn.close()

    return jsonify(travels)


@app.route('/api/travels', methods=['POST'])
def create_travel():

    data = request.get_json()

    required_fields = [
        "from_location",
        "to_location",
        "travel_date",
        "number_of_persons",
        "person_names"
    ]

    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    now = datetime.now().isoformat()

    conn = get_db()
    c = conn.cursor()

    c.execute(
        """
        INSERT INTO travels
        (destination,start_date,end_date,from_location,to_location,travel_date,
        number_of_persons,person_names,budget,notes,status,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            data["from_location"],
            data["travel_date"],
            data["travel_date"],
            data["from_location"],
            data["to_location"],
            data["travel_date"],
            int(data["number_of_persons"]),
            json.dumps(data["person_names"]),
            float(data.get("budget", 0)),
            data.get("notes", ""),
            data.get("status", "upcoming"),
            now,
            now,
        ),
    )

    conn.commit()
    travel_id = c.lastrowid
    conn.close()

    return jsonify({"id": travel_id, "message": "Travel created"}), 201


@app.route('/api/travels/<int:travel_id>', methods=['GET'])
def get_travel(travel_id):

    conn = get_db()
    c = conn.cursor()

    c.execute("SELECT * FROM travels WHERE id = ?", (travel_id,))
    travel = c.fetchone()

    conn.close()

    if not travel:
        return jsonify({"error": "Travel not found"}), 404

    return jsonify(dict(travel))


@app.route('/api/travels/<int:travel_id>', methods=['PUT'])
def update_travel(travel_id):

    data = request.get_json()
    now = datetime.now().isoformat()

    conn = get_db()
    c = conn.cursor()

    c.execute("SELECT id FROM travels WHERE id = ?", (travel_id,))
    if not c.fetchone():
        conn.close()
        return jsonify({"error": "Travel not found"}), 404

    c.execute(
        """
        UPDATE travels
        SET from_location=?,
            to_location=?,
            travel_date=?,
            number_of_persons=?,
            person_names=?,
            budget=?,
            notes=?,
            status=?,
            updated_at=?
        WHERE id=?
        """,
        (
            data["from_location"],
            data["to_location"],
            data["travel_date"],
            data["number_of_persons"],
            json.dumps(data["person_names"]),
            data.get("budget", 0),
            data.get("notes", ""),
            data.get("status", "upcoming"),
            now,
            travel_id,
        ),
    )

    conn.commit()
    conn.close()

    return jsonify({"message": "Travel updated"})


@app.route('/api/travels/<int:travel_id>', methods=['DELETE'])
def delete_travel(travel_id):

    conn = get_db()
    c = conn.cursor()

    c.execute("DELETE FROM travels WHERE id = ?", (travel_id,))

    conn.commit()
    conn.close()

    return jsonify({"message": "Travel deleted"})


@app.route('/api/stats', methods=['GET'])
def get_stats():

    conn = get_db()
    c = conn.cursor()

    c.execute("SELECT COUNT(*) as total FROM travels")
    total = c.fetchone()["total"]

    c.execute("SELECT SUM(budget) as total_budget FROM travels")
    result = c.fetchone()

    conn.close()

    return jsonify({
        "total_trips": total,
        "total_budget": result["total_budget"] or 0
    })


# -------- ERROR HANDLERS --------

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    init_db()
    app.run(debug=True)