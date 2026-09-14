# ORATOR AI — Real-Time AI Communication & Storytelling Coach

ORATOR.AI is an AI-powered real-time communication, storytelling, public speaking, and wit coach. It trains users to become clear, compelling, witty, and emotionally intelligent communicators while preserving their natural flow (*Flow > Perfection*).

---

## Netlify Production Deployment Instructions

### Option 1: GitHub + Netlify Continuous Deployment (Recommended)

1. **Push Repository to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Prepare ORATOR AI for Netlify Production Deployment"
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

2. **Connect to Netlify**:
   - Log in to your [Netlify Dashboard](https://app.netlify.com).
   - Click **"Add new site"** $\rightarrow$ **"Import an existing project"**.
   - Select **GitHub** and choose your repository.

3. **Configure Netlify Build Settings**:
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
   - **Functions Directory**: `netlify/functions`

4. **Add Netlify Environment Variables**:
   - Go to **Site Settings** $\rightarrow$ **Environment Variables**.
   - Add the key:
     - `GEMINI_API_KEY`: `your_actual_gemini_api_key`
   - Click **Deploy Site**.

---

## Local Development

```bash
# Install root dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..

# Start backend server & frontend dev server simultaneously
npm run start
```
- Frontend: `http://localhost:3000`
- Backend API & WebSockets: `http://localhost:5000`

---

## Netlify Architecture & Security

* **Frontend**: React SPA (Vite) with SPA client-side routing fallback (`/*` $\rightarrow$ `/index.html`).
* **Serverless Functions**: Server-side Netlify Functions (`netlify/functions/`) handling API endpoints (`/api/analyze-session`, `/api/health`, `/api/profile`, `/api/test-gemini`, `/api/live-token`).
* **Gemini Key Security**: The permanent `GEMINI_API_KEY` exists strictly as a Netlify server-side Environment Variable. It is **never** exposed to browser JavaScript, HTML, bundles, or client logs.
