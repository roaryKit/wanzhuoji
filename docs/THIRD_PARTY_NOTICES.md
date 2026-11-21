# 第三方清单与“只分发源码”的边界（2026-11-21）

## 本包实际分发什么

七个业务函数均声明 `wx-server-sdk@4.0.2`（上游MIT），保留精确package-lock，含99个运行时依赖条目；实际库代码、node_modules、tarball、浏览器、字体均**不随源码分发**。根项目仅用Node内置测试器，无第三方开发依赖；上一候选的playwright渲染器/依赖已移除，模拟图片另包。七份锁的依赖图相同，包名各自正确。

按锁文件声明：MIT 73、BSD-3-Clause 13、Apache-2.0 7、ISC 2、0BSD 1、BlueOak-1.0.0 1、未声明2。完整包名、版本、公开元信息链接见 `dependencies.json`。这只是声明登记，不等于逐条法律审计或漏洞评估。

## 两个上游待核验项

- `@cloudbase/signature-nodejs@2.2.0`
- `@cloudbase/wx-cloud-client-sdk@1.7.1`

公开npm版本元信息、原锁文件没有明确许可；只读检查公开tarball未找到LICENSE/LICENCE/NOTICE。不能因此推定没有任何其他授权，也不能把上层SDK的MIT自动套到它们身上。本轮未擅自替换SDK或改变身份/审核协议。建议向上游确认授权；若未来选择兼容替代版本，须单独验证功能与安全。

## 可行的当前交付方式

1. 当前仓库只含自有业务源码、包名/版本/下载摘要和锁清单，**不转分发这两个包的实现**。这是比整包vendor/node_modules发布更窄的再分发边界；不因未附依赖实现而声称安装/使用/商用问题自动消失。
2. 新主机通过npm从上游取得依赖。安装和使用仍受各上游条款约束；包可公开下载不等于已授予任意再分发或商用许可。不能给出“绝对合法/全链开源”的保证。
3. 这不妨碍私下准备源码候选，也不是必须无限等待才能整理仓库的技术阻塞。公开推送自有代码前仍要由权利人确认目标、可见性及项目许可/权属；若要求“全部依赖许可已确认”的发行标准，这两项仍是未结项。
4. 若未来附依赖代码、二进制、容器或离线安装包，必须重新逐包确认许可、附所需LICENSE/NOTICE，并评估上述未知项；本候选不提供这样的包。

保留 `legal/third-party/wx-server-sdk-LICENSE.txt` 原文供查阅；这不授权其它包。项目自身仍为UNLICENSED待确认，`docs/legal`的MIT草案不是生效授权。

## 公开参考（不是法律意见）

- GitHub解释：无许可证时默认版权适用，公开可见不等于开放使用授权：
  https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository
- npm说明package-lock描述精确依赖树/下载位置/完整性，旨在跟随源码提交，不需要提交node_modules：
  https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json/
- 上游包公开版本元信息：见本目录dependencies.json，不包含私人仓库或凭证。
