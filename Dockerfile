FROM denoland/deno:2.1.7

EXPOSE 8008

WORKDIR /app

COPY . .

RUN deno i

RUN mkdir /config
RUN mkdir /mangas

ENV CONFIG_PATH=/config
ENV MANGAS_PATH=/mangas
ENV VERBOSE=false

CMD [ "deno", "run", "start" ]