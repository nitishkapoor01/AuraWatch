FROM node:18

# Install necessary OS dependencies for Playwright
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    libnss3 \
    libxss1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install npm dependencies
RUN npm install

# Install Playwright Chromium browser
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

# Copy the rest of the application
COPY . .

# Expose the port
EXPOSE 5000

# Start the server
CMD ["node", "server.js"]
