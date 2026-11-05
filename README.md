# AttendWise — Student Attendance & Exam Eligibility System

[![Build & Test](https://img.shields.io/badge/tests-25%20passed-brightgreen.svg)]()
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

AttendWise is a comprehensive, standalone attendance and exam-eligibility system built with React, Vite, and Tailwind CSS. The business logic lives entirely client-side with full browser persistence, making it 100% serverless and zero-config to deploy.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm 9+

### Installation & Run

From the root directory:
```bash
# Install dependencies
npm --prefix attendance-system install

# Start development server
npm run dev

# Run unit test suite (25 tests)
npm test

# Build for production
npm run build
```

---

## 🌐 Deploy to Vercel

This repository is pre-configured for **one-click deployment** to Vercel:

### Option 1: Root Repository Import (Zero-config)
1. Push this repository to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and select this repository.
3. Keep default settings (`vercel.json` automatically orchestrates install and build).
4. Click **Deploy**.

### Option 2: Subdirectory Import
If you prefer setting the Root Directory directly in Vercel:
1. In the Vercel Project Import screen, set **Root Directory** to `attendance-system`.
2. Framework Preset: **Vite** (auto-detected).
3. Click **Deploy**.

---

## 🔑 Demo Credentials

Pre-filled on the login screen for instant evaluation:

| Role | Email | Password |
|------|-------|----------|
| **Instructor (Admin)** | `teacher@uni.edu` | `teach1234` |
| **Students** | `2022-cs-001@uni.edu` … `2022-cs-012@uni.edu` | `study1234` |

---

## 📁 Repository Structure

```
.
├── attendance-system/       # Core AttendWise React + Vite application
│   ├── src/                 # React components & UI pages
│   │   ├── logic/           # Pure JS business logic & state persistence
│   │   └── pages/           # Student and Teacher dashboards & workflows
│   ├── vercel.json          # SPA rewrite rules
│   └── package.json         # Frontend dependencies and test runners
├── vercel.json              # Root Vercel build & route configuration
├── package.json             # Root workspace scripts (build, dev, test)
└── .gitignore               # Clean ignore rules (excludes node_modules, dist, etc.)
```
