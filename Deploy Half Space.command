#!/bin/sh
site_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

echo "Half Space deployment"
echo "---------------------"
if "$site_root/tools/deploy-site.sh" "Update Half Space site"; then
  echo
  echo "Done. GitHub will update the live site shortly."
else
  status=$?
  echo
  echo "The deployment did not complete. The message above explains why."
  echo "Your files are still safe."
  echo
  printf "Press Return to close this window. "
  read -r ignored
  exit "$status"
fi

echo
printf "Press Return to close this window. "
read -r ignored
