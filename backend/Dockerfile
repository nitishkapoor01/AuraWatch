FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --production

# Copy the rest of the application
COPY . .

# Set dynamic port (Render uses 10000 by default)
ENV PORT=10000
EXPOSE 10000

# Start the server
CMD ["node", "server.js"]
