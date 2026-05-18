# Public Multiplayer Deploy

Public frontend `https://guns.gs` is GitHub Pages. It cannot run the Node backend.

Backend target:

```text
https://api.guns.gs
wss://api.guns.gs/ws
```

Prepared deployment files:

```text
Dockerfile
render.yaml
deploy/backend.env.example
```

Required hosting env:

```text
NODE_ENV=production
GUNS_MONGO_URL=<MongoDB Atlas connection string>
GUNS_MONGO_DATABASE=guns
GUNS_USER_STORE=mongo-collections
GUNS_COOKIE_SECURE=1
```

Start command:

```cmd
npm start
```

DNS:

```text
api.guns.gs -> backend host
```

After backend DNS/SSL is live, verify:

```text
https://api.guns.gs/health
```

Expected store mode:

```text
mongo-collections
```

Render path:

1. Create a new Web Service from the GitHub repo.
2. Use Docker runtime or the included `render.yaml` blueprint.
3. Add `GUNS_MONGO_URL` as a secret environment variable.
4. Add custom domain `api.guns.gs`.
5. In DNS, point `api.guns.gs` to Render's target.
6. Wait for SSL.
7. Open `https://api.guns.gs/health`.
