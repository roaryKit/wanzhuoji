# 数据模型与查询边界

不附带任何真实数据库、旧seed、账号关系或导出日志。以下是代码字段说明，不是可导入用户样本。时间可能为数据库日期或ISO游标，部署时须与查询排序一致。

|集合|核心字段/用途|主要范围|
|---|---|---|
|users|_openid、ageConfirmed/ageDenied、deleting、theme/defaultPrivacy/reminderOn/anonymous、nickname/avatar及各审核状态、uploads、revision|本人设置与服务端投影|
|records|_openid、wineName/category、isSolo、标签/图片/正文、privacy、createdAt/updatedAt、auditStatus/auditVersion、likeCount/commentCount、举报隔离|本人CRUD；公开必须满足审核与隔离条件|
|wines|_openid、name、category、rating、note、createdAt|本人酒单；由记录产生，评分/备注可更新|
|likes|_openid、recordId、createdAt|同一用户/记录确定性标识，点赞/取消幂等|
|comments|recordId、_openid、内容/回复关系、status、线程排序/版本字段|仅可见记录的已通过评论；待审/拒绝隔离|
|reports|举报记录及其处置相关信息|服务端，不给客户端数据库直读|
|rt_tables|name/intro/interest/rules、capacity、owner、members、closed、seq、createdAt/orderKey、fingerprint|发现提供安全摘要；详情区分成员/非成员|
|rt_users|tables、发言速率/日计数字段|成员反向索引与限额|
|rt_requests|tableId、_openid、note、status、at|pending/approved/rejected状态；人工批准才能变成员|
|rt_messages|tableId、_openid、clientId/fingerprint、text/type/replyTo、status、版本/时间/orderKey|已鉴权成员；纯文字，删除后正文清空/占位|
|rt_events|tableId、seq、kind、messageId|增量事件游标|
|rt_reports|tableId/messageId、_openid、reason、createdAt|桌内举报|
|rt_uploads|保留的历史媒体相关集合|当前圆桌图片关闭，不由客户端开放新媒体流程|

`_id`与`_openid`是模型字段，不是本包内真实标识。users、酒款、点赞/申请等部分ID由服务端哈希/业务键产生；圆桌对外成员ID为桌内不透明token，不能把它当openid使用。

## 事务与权限

记录写入和用户revision、点赞计数、成员/反向索引/人数上限、申请批准、解散等通过服务端事务或版本/幂等逻辑约束。每人最多3桌、capacity为5～8、满5成桌；申请成功不等于已入桌。解散是closed及撤权，不伪装为“退出”、不要求硬删真实数据。

## 索引部署审查

代码有按`_openid + createdAt`读取个人内容、公开可见性条件+时间、recordId+线程顺序、tableId+申请状态/消息orderKey/事件seq等查询。索引应根据你所用CloudBase版本与实际报错在独立环境逐条建立并验证；本包**未提供已在你的环境验证过的全量索引脚本**，不能声称零配置可部署。清理用户数据和历史评论迁移有批处理/分页成本，不应为演示在生产运行。
