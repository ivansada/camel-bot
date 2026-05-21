FROM node:20-slim

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

ENV PHONE=6287787943496
ENV NODE_ENV=production

CMD ["node", "render.js"]
