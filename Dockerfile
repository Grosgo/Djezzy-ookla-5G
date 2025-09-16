# Dockerfile - Node 18 + Ookla Speedtest CLI installed via official .deb
FROM node:18-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates gnupg apt-transport-https \
  && rm -rf /var/lib/apt/lists/*

# Download & install a pinned Ookla .deb (change version if needed)
RUN curl -sLo /tmp/speedtest.deb https://install.speedtest.net/app/cli/ookla-speedtest-1.2.0-linux-x86_64.deb \
  && dpkg -i /tmp/speedtest.deb || (apt-get update && apt-get install -y -f) \
  && rm -f /tmp/speedtest.deb

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production || npm install --production

COPY . .

EXPOSE 8080
CMD ["npm", "start"]
