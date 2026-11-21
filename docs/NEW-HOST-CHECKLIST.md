# 新主机清单：空业务数据起步

按根README顺序逐项执行；不是“已替你的环境通过”的证书。

## A. 下载与离线验证
- [ ] 从 https://github.com/roaryKit/wanzhuoji 或本次ZIP取得源码；不复制生产备份、Git历史或旧本地缓存。
- [ ] 安装Node.js 20+、npm、Python 3；核对CHECKS.md中的实际验证版本。
- [ ] 项目根只有标准README.md，不依赖特定盘符、原主机或账号。
- [ ] `npm ci --ignore-scripts --no-audit --no-fund` → `npm test` → `npm run check` → `npm run scan`。
- [ ] 原始占位候选 `npm run check:deploy` 拒绝；这是预期。
- [ ] 需要核对文件完整性时使用CHECKSUMS.sha256；在配置或改代码之前验证，之后摘要当然会变化。

## B. 自己的目标环境（只在私有副本操作）
- [ ] 自己的小程序AppID、自己的开发者身份、独立空云环境。
- [ ] `node scripts/configure.js --appid "自己的AppID" --env "自己的环境ID"`；三份测试配置指纹刷新只反映本地标识变更。
- [ ] 重跑test/check/check:deploy；最后一项只做格式检查，不代替真实平台校验。
- [ ] 核对项目配置、前端config、cloudbaserc、七函数config目标一致；没有原运营环境引用。
- [ ] 不公开配置后的部署副本；不要提交.env、凭证、日志、node_modules和本地截图。

## C. 云端资源（人工确认，不能凭离线测试勾选）
- [ ] 建13个空集合：users/records/wines/likes/comments/reports/rt_tables/rt_users/rt_requests/rt_messages/rt_events/rt_reports/rt_uploads。
- [ ] 每个集合客户端read/write为false；云函数上下文鉴权，不给客户端可伪造身份。
- [ ] 跑实际个人分页、广场、评论线程、圆桌申请/消息/事件查询，按控制台提示建立并验证组合索引。未附全量自动索引脚本。
- [ ] 存储仅允许本人受控路径上传，私有读取不公开，审核后由服务端签名；自行核对当前平台规则语法，模板仅审查清单。
- [ ] 七函数全部安装锁定依赖并在正确环境部署：initUser/submitRecord/getPlaza/mediaCheckCallback/reportRecord/clearMyData/roundtable。
- [ ] 没有私有诊断函数或seed导入脚本；没有默认账号或测试身份后门。
- [ ] 安全接口官方权限、自己的HTTPS审核回调与安全模式JSON、服务端TOKEN/43字符AES_KEY/MODE配置就绪。不能只看config声明。
- [ ] 缺接口/ACL/审核资质时明确停在待配置，不放开权限或使用模拟审核绕过。

## D. 空态、功能与真机
- [ ] 第一次年龄门控；本人确认只产生本人初始化设置，业务列表为空，无欢迎假消息或假用户。
- [ ] 四个列表空态合理，圆桌创建入口可达；新的独立环境没有旧seed。
- [ ] 两个有权使用的成年账号：申请→站内待审计数/列表→批准/拒绝→真正入桌；不代真人审批、不把提交当入桌。
- [ ] 双方允许资料/头像昵称、新旧消息、自己右别人左；未设置/待审有明确兜底，匿名范围按实际投影。
- [ ] 满员5～8/每人3桌、转让/移除/退出/解散撤权；非成员/跨桌不能读私有内容。
- [ ] 公开待审隔离、私密不互见、点赞/评论幂等和删除、历史/增量/弱网重试。
- [ ] 深浅主题/320与390/长文本/状态栏胶囊/输入键盘/滚动恢复；首次加载单独实测。
- [ ] 使用官方开发者工具编译、预览和上传自己的开发版；后台另行核对体验版。没有自动提审/正式发布。

## E. 发布前
- [ ] 仓库地址为 https://github.com/roaryKit/wanzhuoji 。项目权属与许可证仍待权利人确认；MIT草案未自动生效。
- [ ] 接受几何占位素材，或另取得摄影/图标可再分发证明；源码不附模拟宣传图。
- [ ] 两项上游依赖许可未明确事项已记录，未把node_modules作为源代码推送。
- [ ] 教程中的仓库地址为 https://github.com/roaryKit/wanzhuoji ；配图标注模拟，并删除不可证实的性能/上线/全端通过宣称。
