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

# Start the application with serve
CMD ["sh", "-c", "npx serve -s dist -l ${PORT:-8080}"]