FROM node:10-alpine

RUN apk add --no-cache -U \
    tini \
    && rm -rf /var/cache/apk/*

COPY /src /app
#RUN rm /app/config.js
WORKDIR /app
#ENV DEBUG *
ENTRYPOINT ["tini", "--"]
CMD ["node", "--trace-warnings", "/app/hive.js", "--config", "config.kube.js"]