FROM node:18-slim

# Install dependencies for headless Chromium (Puppeteer)
RUN apt-get update && apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libgtk-3-0 \
  libgbm-dev \
  libasound2 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libnss3 \
  libxss1 \
  libpangocairo-1.0-0 \
  libpango-1.0-0 \
  libatspi2.0-0 \
  lsb-release \
  wget \
  gnupg \
  --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy package files first for cached npm install
COPY package.json package-lock.json* ./

RUN npm ci --only=production || npm install --production

# Copy entire project
COPY . ./

# Expose port
EXPOSE 3000

# Default command runs the web server. Railway or other platforms can override to run worker.
CMD ["node", "server.js"]
