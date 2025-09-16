# Use lightweight Node image
FROM node:18-slim

# Install dependencies (curl, ca-certificates, gnupg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Ookla Speedtest CLI directly from official .deb
RUN curl -sLo /tmp/speedtest.deb https://install.speedtest.net/app/cli/ookla-speedtest-1.2.0-linux-x86_64.deb \
    && dpkg -i /tmp/speedtest.deb || apt-get install -y -f \
    && rm /tmp/speedtest.deb

# Set workdir
WORKDIR /app

# Copy package.json first (for caching)
COPY package*.json ./

# Install node dependencies
RUN npm install --production

# Copy all app files
COPY . .

# Expose port (Render uses $PORT)
EXPOSE 10000

# Start the app
CMD ["npm", "start"]
