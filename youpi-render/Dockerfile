FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/youpi
RUN git clone --depth 1 https://github.com/youpi-pg/YouPI-PG.git .

RUN npm install

COPY start.sh patch-upi.mjs proxy.mjs /opt/render/
RUN chmod +x /opt/render/start.sh

ENV NODE_ENV=production
CMD ["/opt/render/start.sh"]
