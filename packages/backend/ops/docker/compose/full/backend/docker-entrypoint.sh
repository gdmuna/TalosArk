#!/bin/sh
set -e

# 确保挂载卷子目录存在，并将所有权交给 node 用户
# 此脚本以 root 运行，完成后直接以 node 身份执行程序，避免额外的信号代理进程
mkdir -p ./data/logs ./data/temp/exports ./data/temp/uploads
chown -R node:node ./data

exec setpriv --reuid=node --regid=node --init-groups -- "$@"
