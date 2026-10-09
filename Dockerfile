# Stage 1: Build the React Application
FROM node:18-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy all source files
COPY . .

# Build the Vite application for production
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Remove default Nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy the custom Nginx configuration for React Router
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built assets from the build stage to Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80 to the outside world
EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
