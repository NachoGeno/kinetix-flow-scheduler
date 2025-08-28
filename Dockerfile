# Use Node.js 18 official image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port (Railway uses dynamic port)
EXPOSE 8080

# Start the application with serve (bind to all interfaces)
CMD ["sh", "-c", "npx serve -s dist -l 0.0.0.0:${PORT:-8080}"]