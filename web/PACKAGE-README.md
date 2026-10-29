# Album Player UI（APUI）

GitHub: https://github.com/harmonyosnews/album-player-ui

适用于 **Album Player for Linux 2.19**，播放器 Web 端口 7778。APUI 是同源静态前端，不修改 aplayer 音频引擎、不新增系统服务/端口。

## 安装

```bash
tar -xzf apui-web-0.1.0.tar.gz
cd apui-web-0.1.0
sudo ./install.sh /opt/aplayer
```

安装脚本会：

1. 备份原 `aplayer.html`、`aplayer.js`、`aplayer.css`、`config.dat` 到 `/opt/aplayer-ui-backup-<时间戳>/`；
2. 写入 `/opt/aplayer/ui/`；
3. 原子替换 `/opt/aplayer/aplayer.html`（运行中替换即生效，无需重启 aplayer）。

安装后打开 `http://<player>:7778/`。

## 回滚

```bash
sudo ./uninstall.sh /opt/aplayer-ui-backup-<时间戳> /opt/aplayer
```

不需要重启 aplayer；浏览器强制刷新即可。

## 兼容/限制

- 只支持 aplayer 2.19 的接口；升级 aplayer 前请跑回归。
- 仅限可信局域网；aplayer 本身无登录。
- 不提供队列、历史、歌词、标签、多房间等 aplayer 没有的能力。
- 设置保存会写入 `config.dat`；保存前建议备份/导出配置。
- 静态资源白名单：只允许 html/js/css/json/png；不要手工加入 svg/字体/webp/mjs/map/txt。

## 许可证与法律

APUI 按 **Apache License 2.0** 授权，见 `LICENSE` 与 `NOTICE`。Copyright 2026 harmonyosnews。使用前请阅读 `USER-AGREEMENT.md`、`DISCLAIMER.md` 和 `THIRD-PARTY-NOTICES.md`。

APUI 发布包不包含 Album Player 二进制、TinyLMS 代码/资源或第三方封面/电台图片；相关权利归其各自权利人。

## 校验

发布包旁会提供 `apui-web-0.1.0.tar.gz.sha256`。在发布包所在目录执行：

```bash
sha256sum -c apui-web-0.1.0.tar.gz.sha256
```
