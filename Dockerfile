FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy server files
COPY server.js .

EXPOSE 5000

CMD ["npm", "start"]
