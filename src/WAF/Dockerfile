FROM debian:latest

ARG APP_TARGET_PORT_BUILD_ARG

RUN apt-get update && \
    apt-get install -y nginx libnginx-mod-http-modsecurity curl tar openssl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/nginx.key \
    -out /etc/nginx/ssl/nginx.crt \
    -subj "/C=FR/ST=IDF/L=Paris/O=TranscendenceWAF/CN=localhost"

RUN mkdir -p /usr/share/modsecurity-crs && \
    curl -L https://github.com/coreruleset/coreruleset/archive/refs/tags/v3.3.5.tar.gz -o /tmp/crs.tar.gz && \
    tar -xzf /tmp/crs.tar.gz -C /usr/share/modsecurity-crs --strip-components=1 && \
    rm /tmp/crs.tar.gz

COPY conf/crs-setup.conf /usr/share/modsecurity-crs/crs-setup.conf
COPY conf/nginx.conf /etc/nginx/nginx.conf
COPY conf/modsecurity/ /etc/nginx/modsecurity/

COPY conf/app_proxy.conf.template /etc/nginx/conf.d/app_proxy.conf.template
RUN sed "s|\${APP_TARGET_PORT}|${APP_TARGET_PORT_BUILD_ARG}|g" /etc/nginx/conf.d/app_proxy.conf.template > /etc/nginx/conf.d/default.conf
# RUN rm /etc/nginx/conf.d/app_proxy.conf.template

EXPOSE 1400 80

CMD ["nginx", "-g", "daemon off;"]