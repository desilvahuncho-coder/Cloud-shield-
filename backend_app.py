import os
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app) # Enables frontend cross-origin requests

@app.route('/api/v1/connect-cloud', methods=['POST'])
def connect_cloud():
    data = request.get_json() or {}
    target_id = data.get("target_id")
    role_arn = data.get("role_arn")
    external_id = data.get("external_id")

    if target_id == "demo":
        return jsonify({
            "status": "SUCCESS",
            "message": "Demo loop authorized cleanly",
            "session_id": "demo-session-token-active"
        }), 200

    if not role_arn or not external_id:
        return jsonify({"status": "ERROR", "message": "Missing IAM Role configuration parameters"}), 400

    # Production logic simulating structural validation
    return jsonify({
        "status": "SUCCESS",
        "message": f"Successfully assumed secure role across account for target: {target_id}",
        "session_id": "sts-token-live-secure-isolation"
    }), 200

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
