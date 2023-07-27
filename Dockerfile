FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm clean-install --ignore-scripts
COPY . .
RUN npm run build
ENTRYPOINT ["node", "."]

# to use this image, specify the command to run; it will override the following line
CMD ["--help"]
