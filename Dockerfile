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

# Start the application with dynamic port
CMD ["sh", "-c", "npx vite preview --host 0.0.0.0 --port $PORT"]