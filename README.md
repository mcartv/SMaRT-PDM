# SMART-PDM: A WEB-BASED AND MOBILE APPLICATION SCHOLARSHIP MONITORING SYSTEM USING OPTICAL CHARACTER RECOGNITION DOCUMENT PROCESSING FOR PAMBAYANG DALUBHASAAN NG MARILAO

A comprehensive web-based and mobile application scholarship monitoring system with optical character recognition (OCR) document processing for **Pambayang Dalubhasaan ng Marilao (PDM)**.

**Live Demo:** https://s-ma-rt-pdm.vercel.app

---

## 📋 System Overview

**SMaRT-PDM** is an integrated digital solution that transforms the scholarship management process at PDM by replacing manual, paper-based procedures with a centralized, web and mobile-based platform. The system streamlines scholarship application processing, document verification, scholar monitoring, financial disbursement tracking, and return of obligations management.

### Core Purpose
The Office for Scholarship and Financial Assistance (OSFA) at PDM manages multiple scholarship programs including:
- **Tertiary Education Subsidy (TES)**
- **Tulong Dunong Program (TDP)**
- **Free Higher Education (FHE)**
- **Private Benefactor Programs** (BC Packaging, Food Crafters, Genmart, Kaizen, etc.)

SMaRT-PDM addresses critical challenges in the existing manual process:
- ❌ Slow, manual application processing (~5.5 minutes per applicant)
- ❌ Fragmented records across paper forms, spreadsheets, and messaging platforms
- ❌ Inefficient document verification requiring physical office visits
- ❌ Poor communication and lack of transparency
- ❌ Difficulty tracking academic performance and return of obligations
- ❌ Delays in generating compliance reports for CHED and UniFAST

---

## 🏗️ System Architecture

SMaRT-PDM is built as a full-stack monorepo with three primary components:

```
SMaRT-PDM/
├── admin/                              # Administrative Portal
│   ├── backend/                        # Express.js REST API
│   │   ├── routes/                    # API endpoints
│   │   ├── services/                  # Business logic & schedulers
│   │   ├── config/                    # Database & auth config
│   │   └── server.js                  # Main app server
│   └── frontend/                       # React + Vite admin interface
│       ├── src/
│       ├── pages/                     # Admin dashboards & modules
│       └── components/                # Reusable UI components
├── mobile/                             # Mobile Application
│   └── smartpdm_mobileapp/            # Flutter app (Android)
│       ├── lib/                       # Dart source code
│       ├── screens/                   # Student-facing interfaces
│       └── pubspec.yaml               # Flutter dependencies
├── ocr-scanner/                        # OCR Document Processing Service
├── supabase/                           # Database migrations & configs
└── [config files]                      # Render.yaml, package.json, etc.
```

---

## 🚀 Key Features

### 👨‍💼 Admin Portal (Web Application)

**Dashboard & Overview**
- Real-time scholarship metrics and analytics
- Scholar and beneficiary counts by program
- OCR hardware status monitoring
- Application pipeline visualization

**Application Management**
- Search and filter scholarship applications
- Track applicant status (Pending, Under Review, Approved, Rejected)
- Document completeness verification
- Generate applicant export lists (spreadsheet)
- Interview scheduling and notifications

**Document Processing & OCR**
- Physical OCR scanning station at OSFA office using Raspberry Pi + camera
- Automatic text extraction (student name, GWA) from scanned documents
- OCR Validation Hub for administrator verification
- Document completeness checklist
- Approval, remarks, or rejection workflow

**Scholar Management**
- Comprehensive scholar profiles with academic records
- GWA status monitoring
- Student Disciplinary Office (SDO) record integration
- UniFAST data management
- Enrollment status tracking

**Return of Obligations (RO)**
- Assign tasks to scholars with department, hours, and deadline
- View RO progress (Pending, Verified, Overdue)
- Verify submitted RO completion proof
- Track community service compliance

**Financial Management**
- Create and manage payout batches
- Track disbursement history
- Monitor payout schedules by academic year/semester
- Generate payout reports

**Communication**
- Centralized messaging system (Admin ↔ Scholars ↔ SDO)
- Announcement creation with scheduled publishing
- Target audience configuration
- SMS notifications for scholarship approvals
- Support ticket management and resolution tracking

**Reports & Analytics**
- Generate consolidated scholarship reports for CHED, UniFAST, benefactors
- Export in PDF, Excel, or CSV formats
- Configurable filters (academic year, semester, program, date range)
- Pre-print preview with benefactor-specific formatting

**System Maintenance**
- Benefactor profile management
- Scholarship program configuration
- Academic year and semester management
- Course and department data maintenance
- User role and access permissions
- Audit trail logging (all administrative actions timestamped)

### 📱 Mobile Application (Scholar Portal - Flutter/Android)

**Authentication**
- Student ID + Password login
- Account registration with multi-step OTP verification
- Password recovery via OTP
- Terms and conditions agreement

**Student Dashboard (Unverified Applicants)**
- PDM institutional information
- Scholarship announcements and updates
- Benefactor overview
- Interview schedule viewing
- FAQ access
- "Apply Now" button for scholarship applications

**Student Dashboard (Approved Scholars)**
- Office and benefactor announcements/updates
- Full notifications panel
- Integrated messaging with OSFA
- Payout schedule (individual and program-specific)
- Document upload portal
- Support ticket submission
- FAQs and institution information

**Application Workflow**
- Multi-step guided application form:
  1. **Personal Information** (name, ID, contact)
  2. **Family Information** (parents/guardians, address)
  3. **Academic Information** (course, honors, clubs)
  4. **Personal Essays** (2 essays, 200-300 words each)
  5. **Document Upload** (required documents checklist)
- Real-time application status tracking
- Interview schedule notifications
- Requirement status alerts

**Scholar Features**
- **Grades Submission**: Upload academic records for GWA monitoring
- **Renewal Documents**: Submit registration certificate and grade form for scholarship renewal
- **Return of Obligations**: View assigned tasks, log daily time in/out, submit completion proof
- **Payout Schedule**: View disbursement dates and amounts
- **Profile Management**: Update personal information, change email, change password via OTP
- **Academic Records Access**: View GWA, enrollment status, grade submissions, RO progress

**Communication**
- Messaging with OSFA for inquiries
- Support ticket creation for issues
- Notification alerts for status changes, payouts, deadlines
- SMS updates (approval notifications)

---

## 📚 Technology Stack

### Backend
- **Runtime**: Node.js with Express.js (v5.2.1)
- **Database**: PostgreSQL via Supabase
- **Authentication**: JWT with bcrypt password hashing
- **Real-time**: Socket.IO for WebSocket communication
- **File Handling**: Multer for document uploads
- **Email**: Nodemailer for notifications
- **SMS**: Twilio for OTP and alerts
- **Security**: CORS, rate limiting, Helmet.js, reCAPTCHA Enterprise

**Key Dependencies**:
```json
{
  "@supabase/supabase-js": "^2.103.0",
  "bcryptjs": "^3.0.3",
  "express": "^5.2.1",
  "express-rate-limit": "^8.5.2",
  "helmet": "^8.2.0",
  "jsonwebtoken": "^9.0.3",
  "multer": "^2.1.1",
  "nodemailer": "^9.0.3",
  "socket.io": "^4.8.3",
  "pdfkit": "^0.17.2",
  "exceljs": "^3.4.0"
}
```

### Admin Frontend
- **Framework**: React 19 with Vite build tool
- **Styling**: Tailwind CSS v4.2.2
- **UI Components**: Radix UI primitives (accessible, unstyled)
- **State Management**: React Context + Socket.IO client
- **Routing**: React Router v7
- **Forms**: React Hook Form with Zod validation
- **Charting**: Recharts for analytics
- **Notifications**: Sonner for toast messages
- **Development**: ESLint for code quality

**Key Dependencies**:
```json
{
  "react": "^19.2.4",
  "react-router-dom": "^7.14.0",
  "@radix-ui/react-*": "latest",
  "tailwindcss": "^4.2.2",
  "recharts": "^3.8.0",
  "socket.io-client": "^4.8.3",
  "react-hook-form": "^7.72.0",
  "sonner": "^2.0.7"
}
```

### Mobile Application
- **Framework**: Flutter (Dart) for cross-platform Android development
- **HTTP Client**: http package for API calls
- **Real-time**: socket_io_client for live updates
- **State Management**: Provider for reactive state
- **File Handling**: file_picker, image_picker, open_filex
- **Document Rendering**: Syncfusion Flutter PDF
- **QR Codes**: qr_flutter for QR generation
- **Responsive Design**: flutter_screenutil for screen adaptation

**Key Dependencies**:
```yaml
http: ^1.2.1
provider: ^6.1.2
socket_io_client: ^3.1.4
file_picker: ^8.1.2
image_picker: ^1.1.2
shared_preferences: ^2.2.3
syncfusion_flutter_pdf: ^33.1.47
qr_flutter: ^4.1.0
```

### Document Processing (OCR)
- **Hardware**: Raspberry Pi 4 Model B (4GB RAM)
- **Camera**: Raspberry Pi Camera Module V3 (12MP)
- **OCR Engine**: Tesseract with Python
- **Image Processing**: OpenCV for preprocessing
- **Text Detection**: EAST model (optional advanced mode)

### Infrastructure
- **Database**: Supabase (PostgreSQL-as-a-Service)
- **Deployment**: Render.com (Docker-based)
- **Database Backups**: Supabase automated backups

---

## 📊 Database Model

The system uses a relational PostgreSQL database with 50+ tables organized into logical domains:

### User & Authentication
- `users` - Login credentials and roles
- `admin_profiles` - OSFA staff information
- `student_profiles` - Student personal details
- `user_devices` - Device tokens for push notifications
- `user_sessions` - Active login sessions

### Academic Structure
- `academic_years` - School years (e.g., 2024-2025)
- `academic_periods` - Semesters within years
- `academic_departments` - Institutional departments
- `academic_courses` - Degree programs by department
- `student_registry` - Bulk student import records

### Scholarship Programs
- `benefactors` - Funding organizations
- `scholarship_program` - Program definitions with GWA thresholds
- `program_openings` - Active scholarship slots and allocations
- `program_requirements` - Document requirements per program
- `scholarship_criteria` - Eligibility rules by year level

### Applications & Documents
- `applications` - Scholarship applications with status
- `application_documents` - Submitted requirement files
- `application_document_reviews` - OCR and admin verification records
- `interviews` - Scheduled interviews and results
- `ocr_extracted_documents` - OCR scanning results
- `scan_records` - OCR validation history

### Scholars & Obligations
- `scholars` - Approved scholarship recipients
- `students` - Student master records
- `return_of_obligations` - RO tasks and progress
- `ro_departments` - Departments for RO assignment
- `renewals` - Scholarship renewal records
- `renewal_documents` - Renewal requirement submissions

### Compliance & Monitoring
- `sdo_records` - Student Disciplinary Office violations
- `payout_batches` - Disbursement batches
- `payout_batch_scholars` - Individual payout records
- `payout_history` - Disbursement transaction history
- `scholar_logs` - Scholar action audit trail

### Communication & Support
- `messages` - Direct messages between users
- `chat_rooms` - Group chat spaces
- `chat_room_members` - Chat room memberships
- `announcements` - Published office announcements
- `notifications` - User notifications
- `support_tickets` - Student support requests
- `faqs` - Frequently asked questions
- `trivia` - Fun facts for students

### System Management
- `audit_logs` - All administrative actions with timestamps
- `reports` - Generated report records
- `user_devices` - Device token management
- `payout_attachments` - Supporting files for payouts

---

## 🛠️ Development Setup

### Prerequisites

- **Backend/Admin**: Node.js 18+ with npm/yarn
- **Mobile**: Flutter SDK 3.11+ with Dart
- **Database**: Supabase account (PostgreSQL)
- **Services**: 
  - Google Cloud Vision API (OCR)
  - Twilio account (SMS/OTP)
  - SendGrid or email service
  - reCAPTCHA Enterprise key

### Installation

#### 1. Clone Repository
```bash
git clone https://github.com/mcartv/SMaRT-PDM.git
cd SMaRT-PDM
```

#### 2. Environment Configuration

**Admin Backend** (`admin/backend/.env`)
```env
# Server
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173

# Database
DATABASE_URL=postgresql://user:password@db.supabase.co:5432/postgres
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your_supabase_anon_key

# Authentication
JWT_SECRET=your_jwt_secret_key_here

# Google Cloud (OCR)
GOOGLE_CLOUD_PROJECT_ID=your_gcp_project
GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcp-credentials.json

# Twilio (OTP/SMS)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Email
SENDGRID_API_KEY=your_sendgrid_key
NODEMAILER_EMAIL=noreply@example.com
NODEMAILER_PASSWORD=your_email_password

# reCAPTCHA
RECAPTCHA_SECRET_KEY=your_recaptcha_secret

# CORS
FRONTEND_ORIGINS=http://localhost:5173,https://yourdomain.com
```

**Admin Frontend** (`admin/frontend/.env.local`)
```env
VITE_API_URL=http://localhost:5000/api
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### 3. Install & Run Backend
```bash
cd admin/backend
npm install
npm start
```
Backend runs on `http://localhost:5000`

#### 4. Install & Run Admin Frontend
```bash
cd admin/frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173`

#### 5. Install & Run Mobile App
```bash
cd mobile/smartpdm_mobileapp
flutter pub get

# Android
flutter run -d android

# iOS (if needed)
flutter run -d ios
```

---

## 📋 Core API Endpoints

### Authentication
- `POST /api/auth/register` - Student registration
- `POST /api/auth/login` - User login
- `POST /api/auth/verify-otp` - OTP verification
- `POST /api/auth/reset-password` - Password recovery

### Applications
- `GET /api/applications` - List applications (admin)
- `POST /api/applications` - Create new application (student)
- `GET /api/applications/:id` - Get application details
- `PATCH /api/applications/:id` - Update application status

### Documents
- `POST /api/applications/:id/documents` - Upload document
- `GET /api/applications/:id/documents` - List application documents
- `GET /api/ocr/validate` - Validate OCR scan results
- `PATCH /api/ocr/:id/approve` - Approve OCR extraction

### Scholars
- `GET /api/scholars` - List scholars (admin)
- `GET /api/scholars/:id` - Get scholar profile
- `PATCH /api/scholars/:id` - Update scholar status
- `GET /api/scholars/:id/renewal` - Get renewal status

### Return of Obligations
- `POST /api/renewals/:id/ro` - Assign RO task
- `GET /api/renewals/:id/ro` - List RO tasks
- `PATCH /api/renewals/:id/ro/:roId` - Update RO status
- `POST /api/renewals/:id/ro/:roId/submit` - Submit RO completion

### Payouts
- `GET /api/payouts` - List payout batches (admin)
- `POST /api/payouts` - Create payout batch
- `GET /api/payouts/:id/scholars` - Get payout distribution
- `PATCH /api/payouts/:id/status` - Update payout status

### Announcements
- `GET /api/announcements` - List announcements
- `POST /api/announcements` - Create announcement (admin)
- `PATCH /api/announcements/:id` - Update announcement
- `POST /api/announcements/:id/publish` - Publish announcement

### Messaging
- `GET /api/messages` - Get message threads
- `POST /api/messages` - Send message
- `GET /api/messages/:threadId` - Get thread history

### Reports
- `POST /api/reports/generate` - Generate report
- `GET /api/reports/:id` - Download report
- `GET /api/reports/templates` - List report templates

### System
- `GET /api/health` - System health check
- `GET /api/audit-logs` - Audit trail (admin)
- `GET /api/system/status` - OCR hardware status

---

## 🔐 Security & Data Protection

### Authentication & Authorization
- **JWT Tokens**: Stateless authentication with expiring tokens
- **Password Hashing**: Bcrypt with salt rounds
- **OTP Verification**: Time-based OTPs sent via email/SMS
- **Role-Based Access Control (RBAC)**:
  - Student (Applicant/Scholar)
  - OSFA Administrator
  - OSFA Coordinator
  - Student Disciplinary Office (SDO)
  - Benefactor
  - Department Head

### Data Protection
- **Encrypted Storage**: Scholar personal data encrypted at rest
- **HTTPS/TLS**: All communications encrypted in transit
- **Input Validation**: Zod schema validation on all endpoints
- **SQL Injection Prevention**: Parameterized queries via Supabase
- **CORS Security**: Whitelist allowed origins

### Audit & Compliance
- **Audit Trail**: Every action logged with user, timestamp, IP address
- **Data Privacy**: Compliance with RA 10173 (Data Privacy Act)
- **Document Verification**: Two-stage verification (OCR + human review)
- **Row-Level Security (RLS)**: Database-level row restrictions

---

## 🧪 Testing & Quality Assurance

### Testing Approach
- **Alpha Testing**: Internal team + capstone adviser
- **Beta Testing**: End-users (scholars, OSFA staff, SDO)

### Evaluation Framework
- **ISO 25010 Standard**: Software quality model
- **Functional Suitability**: Feature completeness and correctness
- **Performance Efficiency**: Response times and resource utilization
- **Compatibility**: Multi-platform support
- **Usability**: Learnability, operability, accessibility
- **Reliability**: Fault tolerance and recovery
- **Security**: Data protection and authorization
- **Maintainability**: Code modularity and testability
- **Portability**: Deployment and scalability

---

## 📱 Supported Devices

### Mobile
- **Android**: 4GB RAM minimum, Android 8.0+
- **iOS**: Not included in initial release

### Desktop
- **Development**: Windows 10/11, macOS, Linux
- **Administration**: Any modern web browser (Chrome, Firefox, Safari, Edge)

### Hardware (OCR)
- **Raspberry Pi 4 Model B** (4GB RAM)
- **Raspberry Pi Camera Module V3** (12MP)
- **7-inch touchscreen display**
- **LED lighting module**
- **64GB microSD card**

---

## 🚀 Deployment

### Production Deployment

#### Render.com Deployment
```yaml
# render.yaml - Already configured in repository
services:
  - name: smartpdm-backend
    runtime: node
    buildCommand: cd admin/backend && npm install
    startCommand: npm start
    envVars:
      - key: DATABASE_URL
        scope: build
      - key: NODE_ENV
        value: production
```

Deploy with:
```bash
git push origin main  # Automatically deploys to Render
```

#### Database Setup
1. Create Supabase project
2. Run migrations from `supabase/` directory
3. Configure Row-Level Security (RLS) policies
4. Enable automatic backups

#### Environment Variables (Production)
- Use Render environment variables dashboard
- Never commit `.env` files to repository
- Rotate JWT_SECRET and API keys regularly

---

## 📖 Project Structure Overview

### Admin Backend Structure
```
admin/backend/
├── server/
│   └── server.js                 # Main Express app + Socket.IO
├── routes/                       # API endpoint handlers
├── services/                     # Business logic
├── config/                       # Database & auth config
├── middleware/                   # Express middleware
├── utils/                        # Helper functions
└── scripts/                      # Data migration scripts
```

### Admin Frontend Structure
```
admin/frontend/
├── src/
│   ├── pages/                    # Page components
│   ├── components/               # Reusable components
│   ├── hooks/                    # Custom React hooks
│   ├── services/                 # API client
│   ├── contexts/                 # React contexts
│   ├── App.jsx                   # Main app component
│   └── main.jsx                  # Entry point
├── public/                       # Static assets
├── index.html                    # HTML template
└── vite.config.js               # Vite configuration
```

### Mobile App Structure
```
mobile/smartpdm_mobileapp/
├── lib/
│   ├── main.dart                 # App entry point
│   ├── screens/                  # UI screens
│   ├── widgets/                  # Reusable widgets
│   ├── services/                 # API & socket services
│   ├── models/                   # Data models
│   ├── providers/                # Provider state management
│   └── constants.dart            # App constants
├── android/                      # Android-specific config
├── ios/                          # iOS config (future)
├── test/                         # Tests
└── pubspec.yaml                 # Dart dependencies
```

---

## 📋 API Response Examples

### Application Status
```json
{
  "application_id": "uuid",
  "student_id": "uuid",
  "program_id": "uuid",
  "application_status": "Under Review",
  "document_status": "Pending Verification",
  "submission_date": "2024-07-10T10:30:00Z",
  "interview_schedule": "2024-07-15T14:00:00Z",
  "documents": [
    {
      "document_type": "Certificate of Registration",
      "file_url": "s3://...",
      "status": "Verified"
    }
  ]
}
```

### Scholar Profile
```json
{
  "scholar_id": "uuid",
  "student_id": "uuid",
  "pdm_id": "2024-001",
  "first_name": "Juan",
  "last_name": "Dela Cruz",
  "program_name": "Tertiary Education Subsidy",
  "gwa": 2.25,
  "status": "Active",
  "ro_progress": 75,
  "payout_history": [
    {
      "amount": 15000.00,
      "date_claimed": "2024-06-15T09:00:00Z",
      "status": "Claimed"
    }
  ]
}
```

---

## 🐛 Troubleshooting

### Backend Issues
- **Connection Error**: Verify Supabase URL and key in `.env`
- **Port Already in Use**: Change `PORT` in `.env` or kill process on port 5000
- **JWT Errors**: Ensure `JWT_SECRET` is set and consistent

### Frontend Issues
- **CORS Error**: Check `FRONTEND_ORIGINS` in backend `.env`
- **White Screen**: Clear browser cache and reload
- **API Not Found**: Verify backend is running on correct port

### Mobile App Issues
- **Cannot Connect**: Verify `API_BASE_URL` points to correct backend
- **OTP Not Received**: Check Twilio credentials and phone number format
- **Document Upload Failed**: Check file size and format restrictions

### OCR Issues
- **Tesseract Not Found**: Verify Python installation and Tesseract package
- **Low Confidence Scores**: Improve document quality, check lighting
- **Character Recognition Errors**: Apply image preprocessing filters

---

## 📚 Key Documents

- **Deployment Guide**: `backend/PRODUCTION_DEPLOYMENT.md`
- **Delivery Checklist**: `DELIVERY_CHECKLIST.md`
- **Database Schema**: Supabase project dashboard
- **System Manuscript**: `SMART-PDM_Manuscript_Final.txt`

---

## 👥 Project Team

**Developers:**
- Jerry Geoff D.S. Bho
- Carl Arthur V. Buenavidez
- Leo Lawrence M. Galve
- Venice Eve Pelima

**Institution:** Pambayang Dalubhasaan ng Marilao (PDM)  
**Program:** Bachelor of Science in Information Technology  
**Submission Date:** October 2026

---

## 📝 License

This project is currently unlicensed. You are free to add a license of your choice.

---

## 🙏 Acknowledgments

Special thanks to:
- Ms. Carmelita L. Dela Cruz, OSFA Coordinator
- PDM Office for Scholarship and Financial Assistance
- Capstone Adviser and Faculty
- All beta testers and end-users who provided feedback

---

## 📞 Support & Contact

For issues, questions, or contributions:
- Check existing GitHub issues
- Review system documentation
- Contact the development team

---

**Status:** Active Development  
**Current Version:** 1.0.0  
**Last Updated:** July 2026
