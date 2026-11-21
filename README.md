# 晚酌集 · 原生微信小程序学习源码

> 基于 **0.3.8-test.1120** 的可移植、脱敏源码整理版（2026-11-21，Asia/Shanghai）。**项目许可证待权利人确认，当前不是已获许可的正式开源发行。** 仅面向18岁以上成年人；学习小程序工程，不劝酒、不宣传健康或疗愈效果。

个人记录、个人酒单、公开内容交流、人工审批的小范围圆桌。保留原生 WXML/WXSS/JavaScript 与七函数目录，下载到新主机后使用**自己的小程序 AppID 与独立云环境**配置。不是“下载即连接现成后台”，不包含原运营环境、账号、数据库或任何测试业务数据。

仓库地址：**https://github.com/roaryKit/wanzhuoji**。许可状态以 [LICENSE.md](LICENSE.md) 为准：待权利人确认，MIT 草案未生效，公开可见不等于已授予开源许可。下载后需要自己的微信开发资格、独立云环境、ACL/索引与审核配置。

## 先选你的目标

- **只读代码/跑离线测试**：完成下方第1～2步即可，不需要微信账号或云凭证。
- **在自己的微信项目运行**：完成第1～7步；需要你自己的开发者资格、AppID、云开发和平台安全接口权限。
- **学习笔记**：[完整跟做教程](docs/LEARNING_GUIDE.md) · [小红书短笔记](docs/XIAOHONGSHU-NOTE.md)。模拟配图单独打包，不放在源码里。

## 当前实现了什么

|模块|源码中的能力|边界|
|---|---|---|
|年龄与资料|18岁确认/拒绝、昵称头像设置及审核状态、默认身份|不使用微信头像昵称自动冒充用户；真实平台审核需独立验证|
|我的酌记|创建/编辑/删除、公开/私密、日期与统计、分页、图片登记|公开内容需审核，私密不等于免除存储安全配置|
|同酌晚风|广场筛选/搜索、详情、点赞取消和幂等、根评论/回复、举报|分享受账号认证和微信平台能力限制；待审内容不公开|
|我的酒单|由记录产生酒款、查看酒款、个人评分与笔记|不是商品商城，不含支付、酒类交易或后台CMS|
|设置|主题跟随系统/深浅、隐私与匿名偏好、提醒偏好、清除本人数据|提醒开关不是已实现微信订阅推送|
|圆桌|发现/搜索/筛选、创建5～8容量、满5成桌、每人最多3桌、申请/批准/拒绝、转让/移除/退出/解散|待审批≠已入桌；非成员不读取桌内消息和成员资料；站内待审计数不是微信推送|
|桌内聊天|纯文字、引用、历史/增量分页、幂等发送、失败重试、删除占位|圆桌图片延期；本人在右、别人左，不按桌主身份决定方向|
|界面/缓存|暖金深浅主题、顶部收缩/固定、动态座位、热tab内容和位置保留、请求合并|首次加载、原生键盘和设备性能仍需量化验证|

## 包里有什么，明确没有什么

```text
miniprogram/             原生页面、组件、工具、暖金深浅主题、自制几何占位素材
cloudfunctions/          7个完整业务函数，公共实现为同步副本
config/                  微信/数据库/存储权限的无凭证配置审查模板
scripts/                 本地配置、语法一致性检查、启发式敏感内容扫描
tests/                   仅内存隔离的自动化测试，不连真实云数据库
docs/                    架构/模型/权限/部署/新主机清单/学习教程/许可审查
.github/                 issue和PR模板；无自动部署或发布凭证
```

**不捆绑**测试账号、业务记录/消息/桌、seed导入脚本、数据库dump、私人诊断函数、生产清理脚本、模拟截图、假记录渲染工具、node_modules、Git历史、证书、密钥、真实二维码或上传回执。测试断言中的虚构输入只在内存SDK桩中使用，不连接或导入线上；`npm test`不等于注入业务测试数据。

前端原“示例桌说明”入口已移除。服务端仍保留识别并拒绝旧模拟桌申请的兼容保护及旧seed查询排除，**这些是拒绝逻辑，不是附送的数据、导入器或假数据回退**；不能为清理字样把安全保护删掉。本包不会删除你现有环境中的任何数据，务必使用新的独立环境。

原摄影、分享图和无法确认来源的图标已替换为自制基础几何占位，不含用户照片；这不是生产摄影效果。素材说明见[ASSETS](docs/ASSETS.md)。

## 1. 在新主机取得源码

安装 Node.js 20+、npm；扫描另外需要 Python 3。验证所用版本见[CHECKS](CHECKS.md)，不声称所有Node版本/操作系统都已实测。

两种方式任选：

- 下载源码ZIP，解压后进入包含本README和package.json的 `wanzhuoji` 目录。Windows可用系统解压；macOS/Linux可用 `unzip wanzhuoji-0.3.8-portable-20261121.zip`。
- 克隆本仓库（仓库根目录即包含本 README 与 `package.json`）：
  ```sh
  git clone https://github.com/roaryKit/wanzhuoji.git
  cd wanzhuoji
  ```

下载路径任意；不依赖原部署主机、共享盘、绝对路径或原作者账号。不要从生产备份或带凭证的部署副本开始。

## 2. 先做离线检查

```sh
node --version
npm --version
python3 --version
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run check
npm run scan
npm run check:deploy
```

Windows若命令为 `python`，最后扫描可直接运行 `python scripts/scan-release.py`。根项目没有第三方开发依赖；仅根 `npm ci` 不能替代七函数运行时依赖安装。测试使用Node自带测试器。

**最后一项此时应该失败**：默认都是显式 `YOUR_WECHAT_APPID` / `YOUR_CLOUDBASE_ENV_ID`。这是配置门控，不是安装失败。`check`只验证语法/路由/JSON/共享副本和依赖一致性；`check:deploy`也仅检查标识格式，绝非云权限或上线资格证明。

继承286项回归，另加4项干净包/空业务验证；本包实际结果以CHECKS.md为准。没有附带要导入的数据库样本，新主机也不会凭空出现历史记录。

## 3. 只在私有部署副本配置自己的环境

1. 再复制一份源码作为**私有部署副本**，公开仓库保留未配置版本。
2. 在微信公众平台准备自己的小程序AppID，在微信开发者工具/云开发控制台建立**全新独立**云环境，确认项目关联正确。不要填写别人的环境。
3. 只在私有副本运行，替换引号中的中文，不要照抄：
   ```sh
   node scripts/configure.js --appid "你自己的小程序AppID" --env "你自己的云环境ID"
   npm test
   npm run check
   npm run check:deploy
   ```
   脚本只替换本地标识，刷新配置相关文件指纹；不连云、不部署、不创建账号/记录。可在第三份临时副本用 `node scripts/configure.js --example` 验证脚本，但示例标识仍应被部署门控拒绝。
4. 核对 `project.config.json`、`miniprogram/utils/config.js`、`cloudbaserc.json`、七函数 `config.json` 的目标一致。不要把配置后的私有副本提交公开仓库；.gitignore不会替你清理源码里嵌入的值。

## 4. 空数据库、权限和索引

在新环境中创建以下**13个空集合**，不导入任何JSON/CSV或历史业务数据：

```text
users records wines likes comments reports
rt_tables rt_users rt_requests rt_messages rt_events rt_reports rt_uploads
```

- 每个集合客户端直读、直写均拒绝（`read: false` / `write: false`）；业务通过云函数、服务端上下文鉴权。`config/database-rules.example.json`是审查清单，不是可以直接导入的平台CLI文件。
- 真实身份来自云函数SDK上下文；不得新增客户端传openid、诊断身份、模拟审核通过等入口。不要为调试把集合改公开读写。
- 按[数据模型](docs/DATA_MODEL.md)逐条验证实际查询与索引；平台版本不同，控制台根据真实缺索引提示建立组合索引。本包**没有在你环境验证过的自动索引部署脚本**。
- 存储规则见 `config/storage-policy.example.json`：本人受控上传路径写入、禁止私有文件无条件公开读、审核后由服务端签名读取。该文件不是通用可执行ACL。当前尚需环境专属人工配置/双账号验证，**这是新环境部署检查项，不是零配置开箱即用**。不要用公开读写绕过图片失败。
- `rt_uploads`是历史模型兼容集合，圆桌新图片功能关闭，不因建立集合而开启。

## 5. 七个函数、依赖和审核回调

全部保留：`initUser`、`submitRecord`、`getPlaza`、`mediaCheckCallback`、`reportRecord`、`clearMyData`、`roundtable`。没有第八个私有诊断函数；文档/部署清单与实际目录一致。

每个函数锁定 `wx-server-sdk@4.0.2`。若需在本机核对安装，以下命令在项目根执行（只安装依赖，不部署）：

```sh
npm --prefix cloudfunctions/initUser ci --ignore-scripts --no-audit --no-fund
npm --prefix cloudfunctions/submitRecord ci --ignore-scripts --no-audit --no-fund
npm --prefix cloudfunctions/getPlaza ci --ignore-scripts --no-audit --no-fund
npm --prefix cloudfunctions/mediaCheckCallback ci --ignore-scripts --no-audit --no-fund
npm --prefix cloudfunctions/reportRecord ci --ignore-scripts --no-audit --no-fund
npm --prefix cloudfunctions/clearMyData ci --ignore-scripts --no-audit --no-fund
npm --prefix cloudfunctions/roundtable ci --ignore-scripts --no-audit --no-fund
```

首次拉取依赖需要能访问npm公开源；离线安装需事先备齐缓存，ZIP不内置依赖实现。上游两个传递包未查到明确许可，见[第三方边界](docs/THIRD_PARTY_NOTICES.md)，不能声称整条依赖链均已获MIT授权。

微信开发者工具导入根目录，确认 `miniprogramRoot: miniprogram/`、`cloudfunctionRoot: cloudfunctions/`；逐函数使用官方“上传并部署：云端安装依赖”，自行核对所选环境/Node运行时与 `cloudbaserc.json` 模板。不是部署整台服务器，无SQL/WebSocket服务需要复用。

真实文本/媒体审核需要小程序资质和官方 `security.msgSecCheck` / `security.mediaCheckAsync` 权限，声明不等于已经开通。审核失败不能用本地桩伪装成功。服务端环境变量：

|变量名|填写方式|
|---|---|
|WZJ_CALLBACK_MODE|`wechat-aes-json`|
|WZJ_CALLBACK_TOKEN|自己的官方回调Token，只在受控服务端设置|
|WZJ_CALLBACK_AES_KEY|自己的43字符EncodingAESKey，只在受控服务端设置|

为 `mediaCheckCallback` 配置平台可达的HTTPS回调地址与微信安全模式JSON；具体入口/网关形式按你实际云控制台核对。不把值写到Git、前端、截图或工单；`.env.example`是变量说明，不会自动给云函数注入环境变量。验证签名、解密、重放/重复回调与审核状态隔离，缺官方真实调用证据时仍标待验。详见[部署验收](docs/DEPLOYMENT.md)。

## 6. 证明空启动与双账号安全

新环境第一次打开先年龄门控；成年本人确认后可创建本人的初始化设置行，但业务记录/酒单/广场/圆桌/消息仍为空。应看到空态和真实创建入口，不应出现虚构用户、记录或欢迎聊天。内存测试已验证服务端空列表及四个实际组件处理空回包；**未替你在新的微信云环境/手机运行**。

本地存储只应由你自己的新项目和真实操作产生。若设备曾导入其他版本，请用开发者工具清理该项目本地缓存，勿清线上数据库。独立AppID/环境必须同时替换，不用改openid冒充别人。

双账号仅用你有权使用的成年测试账号人工验证：A建桌→B申请→A站内待审入口批准/拒绝→双方头像昵称和新旧消息→退出/移除/解散撤权。申请提交不等于入桌；默认/待审资料须有明确兜底；自己右、他人左，桌主角色不决定方向。站内待审计数不是微信订阅推送，未配置/未授权不发送推送。

## 7. 官方预览/上传与新主机验收

在微信开发者工具中登录**自己的开发者身份**，确认自己的AppID、目标环境、路由和真机权限→编译→官方预览→手机逐项验收→在具备权限时点“上传”并自行填写开发版本/说明→到自己的微信公众平台核对开发版及体验设置。预览、开发上传、体验版、提审、正式发布是不同步骤，本源码不会自动完成其中任何一步。

没有捆绑官方CI私钥或脚本。若你另行使用官方CI，按自己的官方白名单/凭证要求设置，不关验证、不复用原项目身份。认证、云资源与平台服务可能有费用；本整理没有付费、提审或正式发布。

完整勾选表：[NEW-HOST-CHECKLIST](docs/NEW-HOST-CHECKLIST.md)。不要把单元测试全绿当作微信真机端到端通过。

## 已知限制与路线图

- 真实跨账号头像/昵称仍待手机复验；真实微信审核、媒体URL有效期、多设备、原生键盘、滚动/安全区需独立验证。
- 热切换缓存/请求合并保留；首次加载仍未证明彻底解决，不承诺手机首绘或全端性能。
- 匿名开关目前在实际资料投影中同时隐藏广场/圆桌资料；文案与作用域仍待收敛，不为演示放宽隐私。
- 圆桌只做纯文字；图片是后续计划。分享/推送受认证、模板和用户授权限制。
- 索引和存储ACL是环境专属人工检查项；本项目不是端到端加密通信产品，云环境管理员仍有数据管理权限。
- 完整代码权属/参考片段/素材和项目许可证仍待确认。[LICENSE.md](LICENSE.md)不是MIT授权，草案不生效；MIT/Apache-2.0如何选见发布清单。

## 文档导航

[架构](docs/ARCHITECTURE.md) · [数据模型](docs/DATA_MODEL.md) · [安全/审核](docs/SECURITY_MODEL.md) · [部署](docs/DEPLOYMENT.md) · [新主机清单](docs/NEW-HOST-CHECKLIST.md) · [学习教程](docs/LEARNING_GUIDE.md) · [小红书笔记](docs/XIAOHONGSHU-NOTE.md) · [依赖](docs/THIRD_PARTY_NOTICES.md) · [素材](docs/ASSETS.md) · [发布前决定](docs/RELEASE-CHECKLIST.md) · [贡献](CONTRIBUTING.md) · [漏洞报告](SECURITY.md)
