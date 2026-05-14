#!/bin/sh
set -eu

if [ "${API_BASE_URL+x}" != "x" ]; then
  API_BASE_URL="http://localhost:8000"
fi

export API_BASE_URL

if [ "${ENABLE_INTERNAL_API_PROXY:-false}" = "true" ]; then
  cp /etc/nginx/azure/nginx.azure.conf /etc/nginx/conf.d/default.conf
fi

envsubst '${API_BASE_URL}' \
  < /usr/share/nginx/html/config.template.js \
  > /usr/share/nginx/html/config.js
