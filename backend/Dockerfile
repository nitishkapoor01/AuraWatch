FROM node:18-slim

# Prevent apt-get from prompting for user input during installation
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Etc/UTC

WORKDIR /app

# Copy package files first (Docker layer caching)
COPY package*.json ./

# Install npm dependencies
RUN npm ci --production

# Install Playwright and its dependencies
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers
RUN npx playwright install chromium --with-deps

# Copy the rest of the application
COPY . .

# Expose the port strictly to help Render's port scanner
ENV PORT=10000
EXPOSE 10000

# Start the server
CMD ["node", "server.js"]
