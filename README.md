# SMaRT-PDM

Scholarship Management and Records Tracking for Pambayang Dalubhasaan ng Marilao.

[Open the live web application](https://smart-pdm.vercel.app/landing)

SMaRT-PDM is a web and Android scholarship management platform developed for the **Office for Scholarship and Financial Assistance (OSFA)** of **Pambayang Dalubhasaan ng Marilao (PDM)**. It brings applications, document review, scholar monitoring, renewals, Return of Obligations (RO), payouts, messaging, and reporting into one system.

## Features

- Student registration, authentication, OTP verification, and account recovery
- Scholarship openings, applications, and digital requirement submission
- Application review, endorsement, status tracking, and notifications
- Scholar profiles, academic monitoring, and scholarship renewals
- RO assignment, attendance, proof submission, and compliance tracking
- Payout batch processing and payout status monitoring
- Announcements, real-time messaging, reports, and audit logs
- Role-based portals for OSFA personnel and partner offices
- Raspberry Pi document capture with OCR-assisted administrative review

OCR output is a review aid. Scanned documents must still be verified by authorized personnel before they are accepted.

## Technology

| Area | Stack |
| --- | --- |
| Administrative web app | React 19, Vite, Tailwind CSS, Socket.IO |
| Student mobile app | Flutter and Dart |
| APIs | Node.js, Express, Socket.IO |
| Data and file storage | PostgreSQL and Supabase |
| OCR station | Python, Tesseract OCR, Raspberry Pi Camera |
| Deployment | Render and Vercel |

## Repository Layout

```text
SMaRT-PDM/
|-- admin/
|   |-- frontend/          # React administrative and partner portals
|   `-- backend/           # Administrative API and web production server
|-- mobile/
|   |-- frontend/          # Flutter student application
|   `-- backend/           # Student-facing API
|-- ocr/scanner/           # Raspberry Pi capture and OCR services
|-- supabase/migrations/   # Database migrations
`-- render.yaml            # Render deployment definition
```

## Getting Started

### Prerequisites

- A current Node.js LTS release and npm
- Flutter with Dart 3.11 or later for the mobile app
- A Supabase project and PostgreSQL connection
- Python 3, Tesseract OCR, and supported Raspberry Pi camera hardware for the OCR station

Clone the repository:

```bash
git clone https://github.com/mcartv/SMaRT-PDM.git
cd SMaRT-PDM
```

### Administrative API

```bash
cd admin/backend
npm install
```

Copy `admin/backend/.env.example` to `admin/backend/.env`, replace every placeholder, and set `PORT=5001` for local development. The web development server proxies API and Socket.IO traffic to that port.

```bash
npm start
```

### Administrative Web App

In a second terminal:

```bash
cd admin/frontend
npm install
npm run dev
```

Open `http://localhost:5173`. In production, set `VITE_API_URL` when the API is hosted on a different origin.

### Student API

```bash
cd mobile/backend
npm install
npm start
```

The student API uses port `5000` by default. Configure its Supabase, database, JWT, email, and SMS credentials before starting it. See [`mobile/backend/PRODUCTION_DEPLOYMENT.md`](mobile/backend/PRODUCTION_DEPLOYMENT.md) for the required variables and deployment checklist.

### Flutter App

```bash
cd mobile/frontend
flutter pub get
flutter run --dart-define=API_BASE_URL=http://YOUR_LAN_IP:5000
```

Use the development machine's LAN address when testing on a physical Android device. For production builds, pass the deployed HTTPS API URL:

```bash
flutter build apk --release \
  --dart-define=API_BASE_URL=https://your-api.example.com
```

Never place a Supabase service-role key or other server credential in the Flutter application.

### OCR Station

The OCR station is hardware-specific. Start with `ocr/scanner/.env.example`, configure the backend URL and shared Pi token, then review the notes under `ocr/scanner/docs/` before running `python main.py` from the `ocr/scanner` directory. Gemini credentials belong only on the backend, never on the Raspberry Pi.

## Database

Database changes are versioned under `supabase/migrations/`. Apply the required migrations to the target Supabase project before running application code that depends on them. Use separate runtime and migration database credentials in production, and keep all `.env` files out of version control.

## Checks

Run the checks relevant to the component you changed:

```bash
# Administrative backend
cd admin/backend
npm test

# Administrative frontend
cd admin/frontend
npm run lint
npm run build

# Flutter app
cd mobile/frontend
flutter analyze
flutter test
```

## Scope

- The student application targets Android devices.
- SMaRT-PDM operates independently from PDM's academic records and enrollment systems.
- Student-submitted records and OCR-extracted information remain subject to staff verification.
- OCR accuracy can be affected by poor print quality, handwriting, folds, damage, lighting, or camera alignment.
- Application submission, uploads, messaging, and notifications require internet connectivity.

## Project Team

- Jerry Geoff D. S. Bho
- Carl Arthur V. Buenavidez
- Leo Lawrence M. Galve
- Venice Eve Pelima

**Institution:** Pambayang Dalubhasaan ng Marilao (PDM)  
**Program:** Bachelor of Science in Information Technology
