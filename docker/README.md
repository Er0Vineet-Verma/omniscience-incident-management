# Docker deployment — Incident Management System

This directory contains everything needed to run the full stack
(React SPA + Spring Boot API + MySQL 8.4) with Docker Compose.

| File                    | Purpose                                                         |
|-------------------------|-----------------------------------------------------------------|
| `Dockerfile.backend`    | Multi-stage build of the backend (Maven build -> slim JRE 21)   |
| `../frontend/Dockerfile`| Multi-stage build of the SPA (Vite build -> nginx, /api proxied)|
| `docker-compose.yml`    | MySQL + backend + frontend stack                                |

## Quick start

From this `docker/` directory:

```bash
docker compose up -d --build
```

- App (SPA): <http://localhost:3000> — nginx serves the build and proxies `/api` to the backend
- Backend API: <http://localhost:8080> (Swagger UI: <http://localhost:8080/swagger-ui.html>)
- Health: <http://localhost:8080/actuator/health>
- MySQL: `localhost:3306` (only because of the optional port mapping — see below)

The backend waits for MySQL's healthcheck to pass before starting
(`depends_on: condition: service_healthy`), so first startup can take a
minute while MySQL initializes its data directory.

### Checking logs

```bash
docker compose logs -f backend     # follow backend logs
docker compose logs -f mysql       # follow MySQL logs
docker compose ps                  # container status + health
```

### Connecting to MySQL

From your host (works while the `3306:3306` mapping is present):

```bash
mysql -h 127.0.0.1 -P 3306 -u ims -pims_password imsdb
```

Or directly inside the container (works even without the port mapping):

```bash
docker compose exec mysql mysql -u ims -pims_password imsdb
```

Credentials (dev defaults, defined in `docker-compose.yml`):
database `imsdb`, user `ims` / `ims_password`, root `root_password`.

> The `3306:3306` host port mapping exists only for convenience (DB GUI
> tools, ad-hoc queries). The backend talks to MySQL over the internal
> Compose network, so you can delete that mapping for production.

### Stopping / resetting

```bash
docker compose down            # stop containers, keep data
docker compose down -v         # stop AND wipe the ims-mysql-data volume
```

## Configuration

The backend container is configured via environment variables consumed by
the `mysql` Spring profile:

| Variable                | Default (compose)  | Meaning                          |
|-------------------------|--------------------|----------------------------------|
| `SPRING_PROFILES_ACTIVE`| `mysql`            | Activates the MySQL datasource   |
| `DB_HOST` / `DB_PORT`   | `mysql` / `3306`   | MySQL host/port on the network   |
| `DB_NAME`               | `imsdb`            | Schema name                      |
| `DB_USER` / `DB_PASSWORD`| `ims` / `ims_password` | DB credentials              |
| `JWT_SECRET`            | dev key in compose | Base64 HMAC key, >= 64 bytes decoded |

Override the JWT secret without editing the file:

```bash
JWT_SECRET="$(openssl rand -base64 64 | tr -d '\n')" docker compose up -d
```

## Healthcheck note

The `eclipse-temurin:21-jre` runtime image ships without curl/wget, so
`Dockerfile.backend` installs `curl` in a single slim apt layer
(`--no-install-recommends` + apt cache cleanup, a few MB) and the
`HEALTHCHECK` probes `/actuator/health`, which is public in the app's
security config.

## Deploying to a server (Ubuntu VM / AWS EC2 / Azure VM)

The same compose file runs unchanged on any Linux host with Docker — that is
the whole point. A vanilla Ubuntu 22.04/24.04 VM, an EC2 instance, or an
Azure VM are all identical from Docker's perspective:

1. **Provision the VM** and open inbound ports `8080` (API) and `22` (SSH)
   in the security group / network security group / firewall.
   Do NOT open `3306` — remove that port mapping instead.

2. **Install Docker Engine + the compose plugin:**

   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER   # log out/in afterwards
   ```

3. **Get the code onto the VM:**

   ```bash
   git clone <your-repo-url> incident-management-system
   cd incident-management-system/docker
   ```

4. **Set a real JWT secret and start the stack:**

   ```bash
   JWT_SECRET="$(openssl rand -base64 64 | tr -d '\n')" docker compose up -d --build
   docker compose ps        # wait until backend is "healthy"
   ```

5. **Updates:** `git pull && docker compose up -d --build` rebuilds and
   restarts only what changed. With the registry-based flow (see the
   commented push/deploy steps in `.github/workflows/ci.yml`) the VM runs
   `docker compose pull && docker compose up -d` instead and never needs
   the source tree or a Maven build.

For production hardening, put the secrets in an `.env` file (chmod 600)
next to `docker-compose.yml`, terminate TLS in front of the API (nginx /
Caddy / an ALB), and back up the `ims-mysql-data` volume.
