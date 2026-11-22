# Smart Business Operations & Client Management System (NEX/INT/26/083)
React (Vite) + Node/Express + MongoDB Atlas.

## Run locally
1. Copy `server/.env.example` to `server/.env` and put your Atlas string in MONGO_URI (ending with /smart-business)
2. `npm run install-all`
3. `npm run seed`
4. `npm run dev` -> http://localhost:5173

Demo logins (password 123456): admin@demo.com, staff@demo.com, client@demo.com

## Roles
- Admin / Staff: manage clients, requests, quotations, projects, reports
- Client: submit requests, accept/reject quotations, track own projects

## Deploy (single Render service)
Build: `npm run install-all && npm run build` | Start: `npm start` | Env: MONGO_URI, JWT_SECRET
