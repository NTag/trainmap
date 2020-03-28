FROM node:13-alpine

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json package-lock.json /usr/src/app/
RUN npm install

COPY . /usr/src/app
RUN cd front && npm install && npm run build && cd ../

EXPOSE 5001
CMD [ "node", "." ]
