# MindForge — Weighted-Practice Quiz App

MindForge is a premium web app for practicing multiple-choice questions across different decks. It features a weighted-random practice algorithm where questions answered wrong resurface more frequently.

---

## Directory Structure

- `backend/` — Node.js + Express API + Mongoose Models
- `frontend/` — React 18 + Vite + Tailwind CSS
- `ProjectDeatils.md` — Original system specifications

---

## Getting Started

### 1. Install Workspace Dependencies
From the root workspace directory, run:
```bash
npm install
```

### 2. Configure Environment Variables

#### Backend Setup (`backend/`):
1. Copy `backend/.env.example` to `backend/.env`.
2. Generate your passcode's bcrypt hash using our utility script:
   ```bash
   npm run hash-passcode <your-passcode-here> --workspace=backend
   ```
3. Set your generated hash into `backend/.env` under `APP_PASSCODE`.
4. Configure your `MONGODB_URI` (MongoDB Atlas URI) and `JWT_SECRET`.

#### Frontend Setup (`frontend/`):
1. Copy `frontend/.env.example` to `frontend/.env`.
2. Keep `VITE_API_URL` matching the backend URL (`http://localhost:4000/api`).

---

## Launching the Application

### Local Development
Start both the backend server and frontend development server concurrently:
```bash
npm run dev
```

- **Frontend client**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:4000/api](http://localhost:4000/api)

### Production Deployment
Since the project is structured as a unified monorepo, you can deploy both backend and frontend on a single server (like Render, Railway, or VPS).

1. Connect this repo to Render or Railway.
2. Configure environment variables (`MONGODB_URI`, `JWT_SECRET`, `APP_PASSCODE`).
3. Set build and start options:
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
