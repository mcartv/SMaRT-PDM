# SMART-PDM: A WEB-BASED AND MOBILE APPLICATION SCHOLARSHIP MONITORING SYSTEM USING OPTICAL CHARACTER RECOGNITION DOCUMENT PROCESSING FOR PAMBAYANG DALUBHASAAN NG MARILAO

SMaRT-PDM is a web-based and Android mobile scholarship monitoring system developed for the **Office for Scholarship and Financial Assistance (OSFA)** of **Pambayang Dalubhasaan ng Marilao (PDM)**.

**Live Demo:** [SMaRT-PDM](https://smart-pdm.vercel.app/landing)

---

## 📋 System Overview

SMaRT-PDM digitizes and centralizes PDM's scholarship processes that were previously handled through physical forms, spreadsheets, manual records, and messaging platforms. The system supports scholarship applications, document verification, application status tracking, scholar monitoring, renewals, Return of Obligations (RO), payouts, announcements, notifications, messaging, reporting, and administrative record management.

The platform is designed to help OSFA process scholarship information more efficiently while giving students a structured way to apply, submit requirements, monitor their status, receive updates, and manage scholar-related requirements through web and mobile interfaces.

## 🔎 OCR Document Processing

SMaRT-PDM includes a physical OCR scanning station at the OSFA office using a **Raspberry Pi 4**, **Raspberry Pi Camera Module**, display controls, and LED lighting. Captured documents are processed using **Python and Tesseract OCR** to extract key information for administrative review.

OCR results are presented to authorized personnel through the OCR validation workflow. **All scanned documents still require human verification before they are considered valid.** The OCR component assists document processing; it does not replace administrative verification.

## 🚀 Core Modules

- Student registration, login, OTP verification, and password recovery
- Scholarship application and digital requirement submission
- Application review, endorsement, status tracking, and notifications
- OCR document capture, text extraction, and administrator verification
- Scholar profile, academic monitoring, and scholarship renewal
- Return of Obligations assignment, attendance, proof, and compliance tracking
- Payout batch processing and payout status monitoring
- Announcements, notifications, and integrated messaging
- Report generation for scholarship and compliance records
- System configuration, reference data management, and audit logs

## 👥 Main Users

- Students, applicants, and scholars
- OSFA Coordinator and authorized administrative personnel
- Student Disciplinary Office
- Guidance Office
- Program Directors and RO Coordinators
- Scholarship benefactors with role-appropriate access

## 🛠️ Technology Stack

- **Web:** ReactJS, HTML, CSS, JavaScript
- **Mobile:** Flutter / Dart (Android)
- **Backend:** Node.js
- **OCR Processing:** Python, Tesseract OCR
- **Database:** PostgreSQL
- **OCR Hardware:** Raspberry Pi 4 with Raspberry Pi Camera Module

## 📌 Scope and Boundaries

- The mobile application is designed for **Android** devices.
- SMaRT-PDM operates independently from PDM's existing academic records and enrollment systems.
- Student-submitted academic and document information remains subject to verification by authorized personnel.
- OCR is intended primarily for computer-printed documents and may be affected by poor document quality, faded printing, folds, damage, or handwritten content.
- Student-facing application submission, uploads, messaging, and notifications require internet connectivity.

## 👨‍💻 Project Team

- Jerry Geoff D.S. Bho
- Carl Arthur V. Buenavidez
- Leo Lawrence M. Galve
- Venice Eve Pelima

**Institution:** Pambayang Dalubhasaan ng Marilao (PDM)  
**Program:** Bachelor of Science in Information Technology  
**Project Manuscript:** October 2026
