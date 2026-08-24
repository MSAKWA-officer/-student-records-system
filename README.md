# Student Records System

A records-management system for a single school (secondary/primary), built
with Node.js/Express (backend) and React (frontend). It covers students,
classes/streams, subjects, teachers, exams and results, attendance, class
enrollments, results reports and result slips, and user accounts (including
student self-service logins).

## Project Structure

```
student-records-system/
├── backend/          # Express API + MySQL (Sequelize ORM)
│   └── src/
│       ├── config/       # Database connection
│       ├── models/       # Sequelize models (Student, Result, Attendance, ...)
│       ├── controllers/  # Business logic
│       ├── routes/       # API endpoints
│       ├── middleware/   # Auth (JWT)
│       └── utils/        # Seed scripts, helpers
│   └── db-fix/       # One-time SQL scripts for schema fix-ups (see its own README)
└── frontend/         # React (Vite) + React Router
    └── src/
        ├── api/          # Axios client
        ├── context/      # Auth state
        ├── pages/        # Login, Dashboard shell
        ├── features/     # Students, Classes, Results, Attendance, Reports, Users, ...
        └── components/
```

## Getting Started

### 1. Database (MySQL)

Make sure MySQL is installed (or use Docker/XAMPP/Laragon), then create the
database:

```sql
CREATE DATABASE school_records;
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env - set your DB_USER, DB_PASSWORD, JWT_SECRET, etc.

npm install
npm run dev          # starts the server and creates any missing tables

# After the server starts for the first time, create the first admin account:
node src/utils/seedAdmin.js
```

The server runs at `http://localhost:5000`.
First admin account: `admin@school.ac.tz` / `Admin@12345` (change this
immediately after logging in).

`npm run dev` only creates tables that don't exist yet — it never alters an
existing table. If you change a model later (new column, new constraint,
etc.), apply that change to your database yourself; see `backend/db-fix/`
for examples and a ready-made script for the student-login feature's schema.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` (Vite's default). The UI is
responsive and works on both desktop and mobile screens.

## Features

- Auth (JWT login), with roles: admin / headteacher / teacher / staff / student
- Students: CRUD, class enrollment, and an optional linked student-portal login
- Classes, Streams, Subjects, Teachers, Subject Allocation
- Academic Years and Terms
- Exams and Results (manual entry or spreadsheet upload)
- Result Slips (single exam) and Results Reports (all subjects, per term or
  whole year), both printable, organized by class in the sidebar
- Attendance, organized by class in the sidebar, with a student-facing
  read-only attendance history
- Class Enrollments, organized by class in the sidebar
- User management, with the ability to create a student's portal login
  directly from their profile page
- A dedicated, simplified navigation menu for student accounts (their own
  report card, result slip and attendance only)
