# Large Team Project Team 22b- Lunax Digital

# AppointHealth AI

This repo contains a full-stack app:

- **Frontend:** Next.js (React + TypeScript + Tailwind), runs on port **3000**
- **Backend:** NestJS (TypeScript) with MongoDB, runs on port **3001**

This guide walks you from a fresh clone to running the project with `npm run dev` in their own folders.

---

## What you need before starting

IMPORTANT! Install these on your machine (if you don’t have them yet):

| Tool       | Purpose              | How to check           |
|-----------|----------------------|------------------------|
| **Node.js** (v18 or newer) | Runs frontend and backend | `node -v`              |
| **npm**    | Installs dependencies | `npm -v` (comes with Node) |
| **MongoDB** | Database for the backend | Local install or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (free tier) |

If any of these commands fail, install Node from [nodejs.org](https://nodejs.org/) and set up MongoDB locally or create an Atlas cluster and get a connection string.

---

## Step 1: Get the project

Clone or download the repo and open a terminal in the **project root** (the folder that contains `frontend/` and `backend/`).

```bash
cd path/to/AppointHealth AI
```

You should see:

- `frontend/` – Next.js app  
- `backend/` – NestJS API  
- `README.md` – this file  

---

## Step 2: Install dependencies

Each app has its own `package.json`, so you install dependencies **twice**—once for the frontend, once for the backend.

**2a. Frontend**

```bash
cd frontend
npm install
cd ..
```

**2b. Backend**

```bash
cd backend
npm install
cd ..
```

After this, both `frontend/node_modules` and `backend/node_modules` should exist. You only need to run these when you first clone or when dependencies change (e.g. after a pull).

---

## Step 3: Set up the backend (env + MongoDB)

The backend needs a `.env` file and a running MongoDB instance.

**3a. Create the env file**

In the `backend/` folder, create a new file named `.env` with at least these values (you can customize them):

```bash
PORT=3001
MONGODB_URI=mongodb(url is whatever is in the connect on your mongodb atlas screen)
FRONTEND_URL=http://localhost:3000
```

If you use MongoDB Atlas, replace `MONGODB_URI` with your Atlas connection string.

**3b. Make sure MongoDB is available**

- **Local MongoDB:** Start the MongoDB service on your machine. The default is in `.env`.
- **MongoDB Atlas:** In `.env`, set `MONGODB_URI` to your Atlas connection string (replace the default).

If MongoDB isn’t running or the URI is wrong, the backend will fail to start when you run `npm run dev`.

---

## Step 4: Run the backend

Open a terminal and run the backend from **its own folder**:

```bash
cd backend
npm run dev
```

- The API will start and listen on **http://localhost:3001**.
- Leave this terminal open; the backend needs to keep running while you work.
- You should see NestJS compile and a message that the app is listening.

If you see a MongoDB connection error, go back to Step 3 and fix your MongoDB URI or ensure MongoDB is running.

---

## Step 5: Seed the Database (Development Only)

After starting the backend, populate the database with dummy data.

In a new terminal:

```bash
cd backend
npm run seed
```

This will:

- Clear existing collections
- Create 1 admin user
- Create 4 clinics
- Create 7 leads
- Create 7 conversations
- Create messages
- Create 1 appointment
- Create audit logs

You can re-run this command anytime to reset and repopulate the database during development.

---

## Step 6: Run the frontend

Open a **second** terminal (the first one is still running the backend). Run the frontend from **its own folder**:

```bash
cd frontend
npm run dev
```

- The app will start and be available at **http://localhost:3000**.
- Leave this terminal open too.
- In the browser, open **http://localhost:3000** to use the app.

You now have:

- **Terminal 1:** backend at http://localhost:3001  
- **Terminal 2:** frontend at http://localhost:3000  

Both are running via `npm run dev` in their respective roots (`backend/` and `frontend/`).

---

## Summary: from scratch to running

1. **Prerequisites:** Node.js 18+, npm, MongoDB (local or Atlas).  
2. **Get the project:** Clone repo, `cd` to project root.  
3. **Install deps:** `cd frontend && npm install`, then `cd backend && npm install`.  
4. **Backend setup:** In `backend/`, create a `.env` file (see Step 3) and set `MONGODB_URI` if needed.  
5. **Run backend:** In one terminal, `cd backend` → `npm run dev`.  
6. **Run frontend:** In another terminal, `cd frontend` → `npm run dev`.  

After that, use http://localhost:3000 for the app and http://localhost:3001 for the API.

---

## Project structure

```
├── frontend/          # Next.js app (run: npm run dev from here)
├── backend/           # NestJS API (run: npm run dev from here)
├── package.json       # Root scripts (e.g. install:all)
```

---

## Backend environment variables

Stored in `backend/.env`:

| Variable       | What it’s for                     | Default |
|----------------|-----------------------------------|--------|
| `PORT`         | Port the API listens on           | `3001` |
| `MONGODB_URI`  | MongoDB connection string         | `mongodb(URL)` |
| `FRONTEND_URL` | Allowed CORS origin for the app   | `http://localhost:3000` |

Change these if your ports or URLs differ. For frontend calls to the API from the browser, you can set `NEXT_PUBLIC_API_URL=http://localhost:3001` in the frontend env if needed.

---

## Deployment

The app is deployed using **Render** (backend) and **Vercel** (frontend), with the GitLab repo mirrored to GitHub to enable OAuth integration.

| Service | Platform | URL |
|---------|----------|-----|
| Backend API | Render (free tier) | `https://appointhealth-backend.onrender.com` |
| Frontend | Vercel (free tier) | `https://appointhealth-frontend.vercel.app` |

### How auto-deploy works

Pushes to the `development` branch on GitLab are automatically mirrored to the connected GitHub repo. Render and Vercel detect the push and redeploy automatically - no manual steps needed.

### Environment variables (set in platform dashboards, not committed to the repo)

**Render (backend):**

| Variable | Value |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `FRONTEND_URL` | Vercel frontend URL (for CORS) |

**Vercel (frontend):**

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | Render backend URL |

###### Note: Render’s free tier spins down after 15 minutes of inactivity. The first request after sleep may take 30 seconds.
###### Due to limitations of the Vercel free tier, only the account owner is able to trigger production deployments. As a result, final deployments must be performed by the project owner to ensure the deployment stage of the pipeline passes successfully.
---


## Useful commands (from each app’s root)

| Command         | Run from    | What it does              |
|-----------------|------------|----------------------------|
| `npm run dev`   | `frontend/` | Start Next.js dev server   |
| `npm run dev`   | `backend/`  | Start NestJS dev server    |
| `npm run seed`   | `backend/`  | Seed database with dummy data    |
| `npm run build` | `frontend/` or `backend/` | Build for production |

If something doesn’t work, double-check: Node version, MongoDB running (or correct Atlas URI), and that you’re running commands from the correct folder (`frontend/` or `backend/`).
