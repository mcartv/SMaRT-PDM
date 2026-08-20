#!/usr/bin/env python3
"""
supabase_client.py - Supabase integration for Raspberry Pi OCR device
Always stores OCR result under the selected applicant + selected document_key
"""

import os
import re
from datetime import datetime, timezone

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=".env")

SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").strip()
SUPABASE_KEY = (
    os.getenv("SUPABASE_KEY")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or ""
).strip()

OCR_RESULTS_TABLE = os.getenv("OCR_RESULTS_TABLE", "ocr_extracted_documents").strip()
IOT_DEVICE_ID = os.getenv("IOT_DEVICE_ID", "").strip() or None
LINKED_RECORD_TYPE = os.getenv("LINKED_RECORD_TYPE", "application").strip()


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def extract_name_guess(text):
    if not text:
        return None

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for line in lines[:10]:
        cleaned = re.sub(r"[^A-Za-z\s.,'-]", "", line).strip()
        words = [w for w in cleaned.split() if w]
        if 2 <= len(words) <= 5 and all(any(ch.isalpha() for ch in w) for w in words):
            return cleaned[:255]

    return None


def extract_gwa_guess(text):
    if not text:
        return None

    matches = re.findall(r"\b(?:[1-4]\.\d{1,3}|5(?:\.0+)?)\b", text)
    for match in matches:
        try:
            value = float(match)
            if 1.0 <= value <= 5.0:
                return value
        except ValueError:
            pass

    return None


class SupabaseClient:
    def __init__(self):
        self.client = None
        self.enabled = False

        if not SUPABASE_URL or not SUPABASE_KEY:
            print("Supabase not configured - local save only")
            return

        try:
            self.client = create_client(SUPABASE_URL, SUPABASE_KEY)
            self.enabled = True
            print("Supabase connected")
        except Exception as exc:
            print(f"Supabase connection failed: {exc}")

    def save_scan(
        self,
        application_id="",
        student_name="",
        student_id="",
        document_key="",
        document_type="",
        extracted_text="",
        raw_text="",
        image_path="",
        word_count=0,
        scan_duration=0,
        ocr_confidence=None,
    ):
        if not self.enabled:
            print("Supabase disabled - local save only")
            return None

        if not application_id or not student_id or not document_key:
            print("Missing required save fields:", application_id, student_id, document_key)
            return None

        extracted_name = extract_name_guess(extracted_text) or student_name or None
        extracted_gwa = extract_gwa_guess(extracted_text)

        payload = {
            "student_id": student_id,
            "linked_record_id": application_id,
            "linked_record_type": LINKED_RECORD_TYPE,
            "document_key": document_key,
            "document_type": document_type or None,
            "file_url": image_path or None,
            "scanned_via_iot": True,
            "iot_device_id": IOT_DEVICE_ID,
            "ocr_extracted_name": extracted_name,
            "ocr_extracted_gwa": extracted_gwa,
            "ocr_confidence": ocr_confidence,
            "ocr_raw_text": (raw_text or extracted_text or "")[:20000],
            "scanned_at": now_iso(),
            "updated_at": now_iso(),
        }

        try:
            existing = (
                self.client
                .table(OCR_RESULTS_TABLE)
                .select("document_id")
                .eq("linked_record_id", application_id)
                .eq("student_id", student_id)
                .eq("linked_record_type", LINKED_RECORD_TYPE)
                .eq("document_key", document_key)
                .limit(1)
                .execute()
            )

            if existing.data:
                document_id = existing.data[0]["document_id"]
                result = (
                    self.client
                    .table(OCR_RESULTS_TABLE)
                    .update(payload)
                    .eq("document_id", document_id)
                    .execute()
                )
                return result.data[0] if result.data else None

            result = (
                self.client
                .table(OCR_RESULTS_TABLE)
                .insert(payload)
                .execute()
            )
            return result.data[0] if result.data else None

        except Exception as exc:
            print(f"Supabase save error: {exc}")
            return None


supabase = SupabaseClient()


