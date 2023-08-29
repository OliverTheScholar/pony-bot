FROM node:20

WORKDIR /app

COPY package*.json ./
COPY . .

RUN npm install
RUN npm run-script build

ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]
