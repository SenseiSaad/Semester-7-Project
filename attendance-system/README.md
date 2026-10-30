# AttendWise — Student Attendance & Exam Eligibility System

QR-based attendance with anti-cheating guarantees and live exam-eligibility tracking.
**Stack:** Django 4 + Django REST Framework + SimpleJWT (SQLite in dev, PostgreSQL-ready) ·
React (Vite) + Tailwind + axios + react-router + qrcode.react.

```
attendance-system/
├── backend/                  Django project
│   ├── manage.py
│   ├── server/               settings/urls (SQLite, CORS for Vite)
│   └── attendance/           models · services · views · permissions · tests · seed_demo
├── frontend/                 React app (Vite + Tailwind)
│   └── src/
│       ├── pages/Landing.jsx · Login.jsx · Signup.jsx · Attend.jsx (scan)
│       ├── pages/teacher/    dashboard · courses · roster/QR-session · manual editor · violations · eligibility
│       └── pages/student/    dashboard · history · notifications (+ shared scan page)
└── test_backbencher.py       47-check adversarial API test (run against live servers)
```

## Setup (dev)

```bash
# 1. backend
cd backend
python3 -m venv ../.venv && source ../.venv/bin/activate     # Windows: ..\.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo          # demo teacher, 3 courses, roster, history, 1 live session
python manage.py runserver 127.0.0.1:8000

# 2. frontend (new terminal)
cd frontend
npm install
npm run dev                         # http://127.0.0.1:5173
```

**Demo logins** (also printed by `seed_demo`):

| role    | login                | password  |
|---------|----------------------|-----------|
| teacher | teacher@uni.edu      | teach1234 |
| student | 2022-cs-001@uni.edu … 2022-cs-008@uni.edu | study1234 |

Unclaimed roster rows (for testing **signup**) are printed by `seed_demo`, e.g.
`CS-301: id=2022-CS-009 code=<8-char claim code>`.

## Roles & what they see

| | Logged out | Teacher | Student |
|---|---|---|---|
| Landing + login/signup | ✅ | ✅ | ✅ |
| `/t/*` dashboard, courses+roster, QR session screen, manual editor, violations, eligibility+CSV | ❌ | ✅ | ❌ (403 at the API too) |
| `/s/*` per-course %, history, scan page, alerts | ❌ | ❌ | ✅ |
| `/attend?c=CODE` (QR target) | → redirects to login, preserves code | shows "teachers don't scan" | marks attendance |

## How the QR anti-spoofing works

- Teacher opens a session → server creates a random per-session **secret**.
- `GET /api/sessions/{id}/qr/` returns `code = "<session_id>.<rotation_ts>.<HMAC-SHA256(secret, "id:ts")[:32]>"`,
  with `rotation_ts` floored to a **20 s window**. The teacher screen re-polls every 5 s and shows a countdown.
- The QR encodes `{frontend}/attend?c=CODE` — phone camera → app → login if needed → auto-submit.
- `POST /api/attendance/scan/` validation order (matters):
  1. HMAC verifies → else **reject** (`invalid`, no violation)
  2. rotation within current + 1 grace window → else **reject** (`expired`, no violation — the honest "I photographed the QR too late" case)
  3. session open → enrolled → else reject (no violation)
  4. **device checks → these create violations**: token must match the student's single registered device
     (`unregistered_device`); a token already used by *another account in the same session* → `device_shared`
  5. optional per-session **campus-IP check** (`CAMPUS_IP_PREFIXES` in settings)
  6. already marked → `already_marked` (**no penalty**, idempotent)
- Every violation is logged, **warns the student in-app**, and the **2nd violation in a course notifies the instructor**.
- Teacher manual edits require a **reason** and stamp `edited_by` (audit); closed sessions freeze their records.
- Teacher can **reset** a student's device (lost phone) from the roster.

## Eligibility rule

`percentage = present / sessions_held × 100` (every created session counts as held; close sessions you didn't hold).

| status | condition | student sees |
|---|---|---|
| Eligible | pct ≥ threshold (default 75) | buffer: "can miss N more classes" |
| At risk | pct ≥ threshold − 5 | condonation case + "attend N in a row" |
| Not eligible | below | detained + recovery plan |

`threshold` is per-course (1–99). Math is unit-tested including "exactly 75% = eligible" and "69.9% = not eligible".

## Testing

```bash
# backend unit/integration tests (45): scan validation, eligibility, permissions, roster, audit
cd backend && python manage.py test

# adversarial suite (47 checks) — start both servers first, then:
python test_backbencher.py
```

The adversarial suite plays "Kamran", a backbencher who: probes anonymous endpoints, games claim codes,
steals a classmate's device token, replays a 40-second-old QR, submits forged/fabricated codes, tries
teacher endpoints with a student JWT, scans a closed session, scans a course he's not enrolled in, and
tries to edit records without a reason. **All 47 checks pass** — every cheat is rejected, and the two
device-cheats are flagged as violations with instructor notification.

## Production notes (out of scope for the demo, listed for honesty)

- Set a real `SECRET_KEY`, `DEBUG=False`, PostgreSQL, and HTTPS (the QR link + JWTs should never travel over http).
- Move the per-session QR secret signing to short-lived tokens if you scale beyond one campus.
- Device tokens are self-reported by the browser; for stronger guarantees add a fingerprinting lib.
- `seed_demo` passwords are demo-only; create real users via the admin (`/admin/`) or a management command.
