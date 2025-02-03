FROM debian

EXPOSE 8008

WORKDIR /app

COPY dist/main ./main

RUN mkdir /config
RUN mkdir /mangas

ENV CONFIG_PATH=/config
ENV MANGAS_PATH=/mangas
ENV VERBOSE=false

# ENTRYPOINT [ "main" ]

CMD [ "./main" ]