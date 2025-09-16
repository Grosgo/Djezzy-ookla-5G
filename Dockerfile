# Dockerfile - Node 18 + Ookla Speedtest CLI installed via official .deb
FROM node:18-slim

ENV DEBIAN_FRONTEND=noninteractive

# Install small required tools
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates gnupg apt-transport-https \
  && rm -rf /var/lib/apt/lists/*

# Download and install Ookla Speedtest CLI .deb (pin to a known stable version)
# If you want the latest, you can change the filename to the latest release .deb
RUN curl -sLo /tmp/speedtest.deb https://install.speedtest.net/app/cli/ookla-speedtest-1.2.0-linux-x86_64.deb \
  && dpkg -i /tmp/speedtest.deb || (apt-get update && apt-get install -y -f) \
  && rm -f /tmp/speedtest.deb

# Create app directory
WORKDIR /app

# Copy package files and install dependencies (cache layer)
COPY package*.json ./
RUN npm ci --only=production || npm install --production

# Copy application files
COPY . .

# Expose port (Render uses environment variable PORT)
EXPOSE 8080

# Start the app
CMD ["npm", "start"]
