# Hostel Management System

A production-grade, multi-hostel hostel management platform.

- **Frontend:** vanilla HTML/CSS/JS single-page app (hash-routed, ES modules), served statically.
- **Backend:** Java Spring Boot 3 REST API with Firebase Admin SDK (optional; the SPA talks to Firebase directly).
- **Data:** Firebase Authentication + Cloud Firestore + Cloud Storage.
- **Deployment:** Vercel (static SPA) + Firebase.

## Features

- Role-based portals: **Administrator** (dashboard, students, rooms, allocation, attendance, mess, complaints, announcements, payments, published bills) and **Student Resident** (profile, attendance, fee dues, payments, complaints, mess, announcements).
- Multi-hostel (multi-tenant): every document carries a `hostelId`; each admin/student only sees their own hostel.
- Room allotment with branch/year filters, random allocation, live room occupancy, hide-full-rooms, and a consolidated allocations list.
- Automated monthly fee generation from attendance, published locked bills, payment UTR verification, and CSV export.

## Tech Stack

| Layer      | Technology                                        |
|------------|---------------------------------------------------|
| Frontend   | Vanilla JS ES modules, hash routing               |
| Backend    | Java 21, Spring Boot 3.2, Firebase Admin SDK 9.2  |
| Database   | Cloud Firestore (rules-scoped per hostel)         |
| Auth       | Firebase Authentication (email/password)          |
| Storage    | Firebase Storage (QR uploads)                     |
| Hosting    | Vercel                                            |

## Repository Layout

```
├── index.html            # Single-page application shell
├── app.js                # UI logic (admin + student portals)
├── auth.js               # Auth context, login routing, provisioning
├── firebase-config.js    # Firebase SDK initialisation (live config)
├── services/db-service.js# Firestore data-access layer (hostel scoped)
├── style.css             # Application styles
├── firestore.rules       # Hostel-scoped security rules
├── storage.rules         # Scoped storage bucket rules
└── backend/              # Optional Spring Boot REST API
    └── src/main/java/com/hostelmanagement
        ├── controller/   # REST controllers
        ├── service/      # Business logic (Firebase Admin + Firestore)
        ├── config/       # Security, CORS, Firebase config
        └── security/     # ID-token filter, tenant isolation, error writer
```

## Local Development

The frontend needs a static HTTP server (Firebase SDK modules require `http://`, not `file://`):

```powershell
python -m http.server 5500 --bind 127.0.0.1
# open http://localhost:5500/
```

Firebase config is in `firebase-config.js`. `cors.allowed-origins` in
`backend/src/main/resources/application.properties` mirrors the frontend origin
(override via `CORS_ALLOWED_ORIGINS` for production).

### Backend

Requires Java 21 and Maven:

```bash
cd backend
mvn spring-boot:run
```

Credentials: place a service-account JSON at `backend/config/serviceAccountKey.json`
(`firebase.config.path=classpath:serviceAccountKey.json`) or rely on
Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS`).

## Multi-Hostel Provisioning (one time per hostel)

1. Create the admin account in **Firebase Authentication** (email/password) — emails are globally unique.
2. Create `admins/{uid}` in Firestore:
   ```json
   { "name": "Warden", "email": "warden@example.com", "role": "admin",
     "hostelId": "<newHostelId>", "status": "active" }
   ```
3. Create `hostels/<newHostelId>`: `{ "name": "Hostel Name", "code": "HN", "status": "active" }`.
4. Log in as that admin and seed branches/rooms from the UI.
5. Create student accounts from the **Create New Student Account** form (creates Auth + `students/{uid}` automatically).

`hostelId` must be unique per hostel; room IDs are `<hostelId>_R_<roomNo>` so
duplicate room/roll numbers across hostels never collide.

## Security Design

- **Firestore rules** resolve an account's hostel from `admins/{uid}` (else
  `students/{uid}`) and allow read/write only on documents of that same hostel.
  No catch-all grants; unmatched paths are denied.
- **Storage rules** allow QR uploads only to `qr/<hostelId>/...` by that
  hostel's admin; all other paths are denied by default.
- **Backend**: every `/api/**` call requires a verified Firebase ID token;
  CORS origins are centralised in `cors.allowed-origins`; tenant isolation
  rejects `hostelId` queries outside the caller's own hostel; JSON 401/403
  bodies; internal exception details never reach clients.
- **Auth UI**: a login only succeeds when a matching `admins/{uid}` or
  `students/{uid}` document exists — accounts are never auto-promoted to
  admin, and there is no simulation/demo mode (official-use only; the
  Firebase project is the single source of identity).

## Deployment (Vercel)

`vercel.json` rewrites all routes to `index.html` and disables caching of the
HTML shell. Push the repo to GitHub and import it in Vercel. Deploy the
`firestore.rules` / `storage.rules` with:

```bash
firebase deploy --only firestore:rules,storage
```

## Notes

- Students' passwords are never stored in Firestore.
- `.env` (Vite-style config) is not used and is gitignored.
- `backend/BOOT-INF/` merged JAR artifacts are gitignored and must not be committed.