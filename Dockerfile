# Dockerfile - Node 18 + Ookla Speedtest CLI (Debian-based)
FROM node:18-bullseye-slim

ENV DEBIAN_FRONTEND=noninteractive

# Install required tools and add Ookla repo (official install script)
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates gnupg lsb-release apt-transport-https \
  && curl -s https://install.speedtest.net/app/cli/install.deb.sh | bash \
  && apt-get update \
  && apt-get install -y --no-install-recommends speedtest \
  && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Copy package files and install dependencies first (cache layer)
COPY package*.json ./
RUN npm ci --only=production || npm install --production

# Copy app source
COPY . .

# Ensure the frontend is served and server uses process.env.PORT
ENV NODE_ENV=production

# Expose port (Render will map its own)
EXPOSE 8080

# Run the app
CMD ["node", "server.js"]
