FROM node:10-alpine

RUN apk add --no-cache -U \
    tini \
    git \
    && rm -rf /var/cache/apk/*

COPY /src /app
WORKDIR /app
RUN npm install
#ENV DEBUG *

# CLEANUP
RUN apk del git

ENTRYPOINT ["tini", "--"]
CMD ["node", "--trace-warnings", "/app/hive.js", "--config", "config.kube.js"]
