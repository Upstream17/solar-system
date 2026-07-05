# AGENTS.md — 给 AI 助手的快速上下文

> 新会话开始时，**先读 `PROJECT_INDEX.md`** 获取项目全貌，再决定要不要读具体源文件。

## 关键事实（最高优先级）

1. **基线 HEAD**：`cc2564b`（包含 PROJECT_INDEX.md 文档）
2. **回滚基线**：`8c841a4`（lighting/planets/scene/ui 全部回到 46fd802 状态 + 删除 EdgeGlow/FakeGlow）
3. **项目类型**：纯前端 Three.js r160 太阳系 3D 模拟器，**零构建**（无 package.json / 无 npm）
4. **依赖管理**：`<script type="importmap">` + unpkg CDN
5. **部署**：Cloudflare Pages 自动部署（直接 git push）

## 当前已知未完成任务

- **太阳辉光优化**：用户对当前 4 层 sprite 方案不满意（"假"），下一会话可继续调研 `pmndrs/postprocessing` 的 `GodRaysEffect`，importmap 加一行即可。详见 `PROJECT_INDEX.md` §5-6。

## 用户偏好（参见 USER_PROFILE，跨会话生效）

- 中文学术/工程设计报告写作风格硬性偏好
- 解释用比喻 + 完整可执行方案
- 不编造验收步骤
- 不熟悉 JS / CSS / HTML 细节 → 给白话解释
- 对"假"反馈明确 → 不要硬装"成功了"

## 工作流建议

1. **新会话开头**：读 `PROJECT_INDEX.md` §0-3（不到 5 分钟）就能掌握现状
2. **避免重复探索**：不要挨个 `read_file` 读所有 .js 文件
3. **改代码后**：更新 `PROJECT_INDEX.md` 的 commit 列表（§5）和"基线 commit"（§4）
4. **遇到不确定**：优先在 `PROJECT_INDEX.md` 找答案，找不到再读源码

## 重要约束

- **不要升级 three 版本** —— `PROJECT_INDEX.md` §8 有说明
- **不要引入 npm 依赖** —— 项目零构建，加依赖会破坏 Cloudflare Pages 部署
- **commit 之前先确认 git status** —— 避免误提交测试文件