FROM node:18-slim

# Install Playwright's OS-level dependencies (slim variant needs these)
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    libxss1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    libx11-xcb1 \
    libxcomposite1 \
    libxrandr2 \
    libxdamage1 \
    libpango-1.0-0 \
    libcairo2 \
    libcups2 \
    libdrm2 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first (Docker layer caching)
COPY package*.json ./

# Install npm dependencies
RUN npm ci --production

# Install ONLY Chromium (not Firefox/WebKit — saves ~400MB)
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

# Copy the rest of the application
COPY . .

# Expose the port
EXPOSE 5000

# Start the server
CMD ["node", "server.js"]
