#!/usr/bin/env python3
"""
web_server.py - Raspberry Pi IoT OCR device API

Modes:
- POST /scan              -> headless single-scan mode
- POST /scan-interactive  -> interactive button-controlled mode
"""

import os
import time
import socket
import signal
import threading
import subprocess
from pathlib import Path

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

app = Flask(__name__)
CORS(app)

LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)

PYTHON_BIN = os.getenv("PYTHON_BIN", "python3").strip()
WEB_SERVER_PORT = int(os.getenv("WEB_SERVER_PORT", "5000"))
IOT_OCR_API_KEY = os.getenv("IOT_OCR_API_KEY", "").strip()
SCAN_LOG_FILE = LOG_DIR / "scan_runner.log"

state_lock = threading.Lock()
scanning = False
current_job = {}
last_result = None
scanner_process = None


def get_ip():
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        ip_addr = sock.getsockname()[0]
        sock.close()
        return ip_addr
    except Exception:
        try:
            output = os.popen("hostname -I").read().strip().split()
            return output[0] if output else "unknown"
        except Exception:
            return "unknown"


def authorized(req):
    if not IOT_OCR_API_KEY:
        return True
    return req.headers.get("x-iot-ocr-key", "").strip() == IOT_OCR_API_KEY


def validate_payload(payload):
    required = [
        "application_id",
        "student_id",
        "student_name",
        "document_key",
        "document_type",
    ]
    return [key for key in required if not str(payload.get(key, "")).strip()]


def build_command(payload, interactive=False):
    command = [
        PYTHON_BIN,
        "main.py",
        "--application-id", str(payload["application_id"]).strip(),
        "--student-id", str(payload["student_id"]).strip(),
        "--student-name", str(payload["student_name"]).strip(),
        "--document-key", str(payload["document_key"]).strip(),
        "--document-type", str(payload["document_type"]).strip(),
    ]

    if not interactive:
        command.append("--headless-single-scan")

    return command


def watch_process(log_handle):
    global scanning, current_job, last_result, scanner_process

    process = None
    with state_lock:
        process = scanner_process

    if process is None:
        try:
            log_handle.close()
        except Exception:
            pass
        return

    return_code = process.wait()

    try:
        log_handle.flush()
        log_handle.close()
    except Exception:
        pass

    with state_lock:
        if current_job:
            current_job["status"] = "completed" if return_code == 0 else "failed"

        last_result = {
            "returncode": return_code,
            "log_file": str(SCAN_LOG_FILE),
            "finished_at": int(time.time()),
            "success": return_code == 0,
            "job": dict(current_job) if current_job else {},
        }
        scanning = False
        scanner_process = None


def start_scan_job(payload, interactive=False):
    global scanning, current_job, last_result, scanner_process

    missing = validate_payload(payload)
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    with state_lock:
        if scanner_process is not None and scanner_process.poll() is None:
            return jsonify({
                "error": "Scanner is currently busy",
                "current_job": current_job,
            }), 409

    command = build_command(payload, interactive=interactive)

    try:
        with open(SCAN_LOG_FILE, "a", encoding="utf-8") as log_handle:
            log_handle.write("\n" + "=" * 80 + "\n")
            log_handle.write(f"Started scan job at {int(time.time())}\n")
            log_handle.write(f"Mode: {'interactive' if interactive else 'headless'}\n")
            log_handle.write(f"Command: {' '.join(command)}\n")

        log_handle = open(SCAN_LOG_FILE, "a", encoding="utf-8")

        process = subprocess.Popen(
            command,
            cwd=str(BASE_DIR),
            stdout=log_handle,
            stderr=log_handle,
            start_new_session=True,
            text=True,
        )

        with state_lock:
            scanner_process = process
            scanning = True
            current_job = {
                "application_id": str(payload["application_id"]).strip(),
                "student_id": str(payload["student_id"]).strip(),
                "student_name": str(payload["student_name"]).strip(),
                "document_key": str(payload["document_key"]).strip(),
                "document_type": str(payload["document_type"]).strip(),
                "status": "running",
                "pid": process.pid,
                "mode": "interactive" if interactive else "headless",
            }
            last_result = {
                "returncode": None,
                "log_file": str(SCAN_LOG_FILE),
                "started_at": int(time.time()),
                "mode": "interactive" if interactive else "headless",
            }

        threading.Thread(target=watch_process, args=(log_handle,), daemon=True).start()

        response = {
            "status": "started",
            "async": True,
            "mode": "interactive" if interactive else "headless",
            "job": current_job,
            "log_file": str(SCAN_LOG_FILE),
        }

        if interactive:
            response["message"] = (
                "Scanner started in interactive mode. "
                "Use LEFT button to capture/confirm and RIGHT button to cancel/back."
            )

        return jsonify(response), 202

    except Exception as exc:
        with state_lock:
            scanning = False
            scanner_process = None
            current_job = {}
            last_result = {
                "returncode": -1,
                "error": str(exc),
                "log_file": str(SCAN_LOG_FILE),
                "finished_at": int(time.time()),
            }
        return jsonify({"error": str(exc)}), 500


@app.route("/", methods=["GET"])
def root():
    with state_lock:
        alive = scanner_process is not None and scanner_process.poll() is None
        return jsonify({
            "service": "iot-ocr-device",
            "online": True,
            "ip_address": get_ip(),
            "port": WEB_SERVER_PORT,
            "scanning": alive,
            "current_job": current_job,
            "last_result": last_result,
        })


@app.route("/scan", methods=["POST"])
def start_scan():
    if not authorized(request):
        return jsonify({"error": "Unauthorized"}), 401

    payload = request.get_json(silent=True) or {}
    return start_scan_job(payload, interactive=False)


@app.route("/scan-interactive", methods=["POST"])
def start_scan_interactive():
    if not authorized(request):
        return jsonify({"error": "Unauthorized"}), 401

    payload = request.get_json(silent=True) or {}
    return start_scan_job(payload, interactive=True)


@app.route("/status", methods=["GET"])
def status():
    if not authorized(request):
        return jsonify({"error": "Unauthorized"}), 401

    with state_lock:
        alive = scanner_process is not None and scanner_process.poll() is None
        return jsonify({
            "online": True,
            "scanning": alive,
            "current_job": current_job,
            "last_result": last_result,
        })


@app.route("/cancel", methods=["POST"])
def cancel_scan():
    global scanning, current_job, last_result, scanner_process

    if not authorized(request):
        return jsonify({"error": "Unauthorized"}), 401

    with state_lock:
        if scanner_process is None or scanner_process.poll() is not None:
            return jsonify({"status": "idle"}), 200

        process = scanner_process

    try:
        os.killpg(process.pid, signal.SIGTERM)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

    with state_lock:
        if current_job:
            current_job["status"] = "cancelled"
        last_result = {
            "returncode": -15,
            "log_file": str(SCAN_LOG_FILE),
            "finished_at": int(time.time()),
            "success": False,
            "cancelled": True,
            "job": dict(current_job) if current_job else {},
        }
        scanning = False
        scanner_process = None

    return jsonify({"status": "cancelled", "current_job": current_job}), 200


if __name__ == "__main__":
    print("=" * 50)
    print("Raspberry Pi IoT OCR Device API")
    print("=" * 50)
    print(f"Listening on http://0.0.0.0:{WEB_SERVER_PORT}")
    print(f"Local IP: {get_ip()}")
    print(f"Log file: {SCAN_LOG_FILE}")
    app.run(host="0.0.0.0", port=WEB_SERVER_PORT, debug=False)
