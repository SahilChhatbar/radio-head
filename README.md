# 🎧 RadioVerse

RadioVerse is a modern radio streaming web app built with the **MERN** stack.  
The frontend is powered by **Next.js (React 19)** with **Radix UI**, **Zustand** for global state, and **TanStack Query** for efficient server-state management.  
The backend is an **Express + MongoDB** API with JWT and Google OAuth authentication.

---

## ✅ Tech Stack

### Client

- Next.js (App Router) + React 19
- Radix UI (`@radix-ui/themes`, Dialog, Slider)
- Zustand
- TanStack React Query
- Axios
- HLS Streaming (`hls.js`)
- Tailwind CSS
- TypeScript

### Server

- Node.js + Express
- MongoDB + Mongoose
- JWT Auth + Google OAuth
- dotenv, cors, cookie-parser, express-session

---

## 📦 Prerequisites

Make sure you have:

- Node.js `>=16`
- npm `>=8` or Yarn
- MongoDB (local or cloud)

---

## 🚀 Setup & Run (Local)

> ⚠️ Important: Start the **server first**, then the **client** in another terminal.

---

### 1) Start Server (Backend)

Open terminal #1:

```bash
cd server

# install dependencies
yarn
# or: npm install

# run backend in dev mode
yarn dev
# or: npm run dev
```

✅ Server will start on: `http://localhost:5000`

---

### 2) Start Client (Frontend)

Open terminal #2:

```bash
cd client

# install dependencies
yarn
# or: npm install

# run frontend in dev mode
yarn dev
# or: npm run dev
```

✅ Client will start on: `http://localhost:3000`

---

## 🔐 Environment Variables

Create a `.env` file inside the `server/` directory:

```env
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/radioverse
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

---

## 📜 Scripts

### Client Scripts

```bash
yarn dev
yarn build
yarn start
yarn lint
```

### Server Scripts

```bash
yarn dev
yarn start
yarn test
yarn test:watch
yarn test:coverage
yarn lint
```

---

## 👨‍💻 Author

**Sahil: https://sahil-chhatbar.vercel.app/**
