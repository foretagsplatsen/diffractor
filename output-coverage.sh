#!/usr/bin/env bash
cat coverage/PhantomJS/index.html | grep  -Pzo '<span[^>]+>([^<]+)</span>\s*<span[^>]+>Lines' | perl -p -e 's/\n//g' | perl -p -e 's/[^>]+>([^%]+)[^<]+<\/span>[^>]+>(Lines)/\2: \1\/100\n/'
