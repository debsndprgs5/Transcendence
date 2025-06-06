FROM debian:latest

ARG CRS_VERSION=v3.3.5

RUN apt-get update && \
    apt-get install -y nginx libnginx-mod-http-modsecurity curl tar && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /usr/share/modsecurity-crs && \
    curl -L https://github.com/coreruleset/coreruleset/archive/refs/tags/v3.3.5.tar.gz -o /tmp/crs.tar.gz && \
    tar -xzf /tmp/crs.tar.gz -C /usr/share/modsecurity-crs --strip-components=1 && \
    rm /tmp/crs.tar.gz

COPY conf/crs-setup.conf /usr/share/modsecurity-crs/crs-setup.conf

COPY conf/nginx.conf /etc/nginx/nginx.conf
COPY conf/modsecurity.conf /etc/nginx/modsecurity/main.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]