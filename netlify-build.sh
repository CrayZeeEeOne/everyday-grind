#!/bin/sh
# Підставляє адресу Apps Script у сайт, щоб вона не лежала в публічному репозиторії.
set -e
if [ -z "$API_URL" ]; then
  echo "API_URL не задано: сайт збереться в демо-режимі."
  exit 0
fi
case "$API_URL" in
  *[!A-Za-z0-9:/._-]*) echo "API_URL містить зайві символи (пробіли чи лапки?)"; exit 1 ;;
  https://script.google.com/*/exec) ;;
  *) echo "API_URL має починатися з https://script.google.com/ і закінчуватися на /exec"; exit 1 ;;
esac
printf "window.EG_CONFIG = { apiUrl: '%s' };\n" "$API_URL" > site/config.js
echo "Адресу API підставлено."
