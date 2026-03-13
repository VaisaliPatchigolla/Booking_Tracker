
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from datetime import datetime
import json

from database import get_db, init_db

app = Flask(__name__, static_folder='static', static_url_path='/static', template_folder='templates')
CORS(app)


# Serve Pages
@app.route('/')
def serve_home():
    return send_from_directory('templates', 'dashboard.html')


@app.route('/add')
def serve_add():
    return send_from_directory('templates', 'index.html')


@app.route('/edit/<int:travel_id>')
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

    c.execute("SELECT * FROM travels ORDER BY travel_date ASC")

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
    # app.run(debug=True, host="172.16.17.138", port=5000)
    app.run(debug=True)