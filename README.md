# Segmenta · 视频片段标注平台

给机器人示教视频标时间段的多人协作平台：标注员在时间轴上圈出有用片段，管理员审核后按**提交日期**统计每个标注员的有效工时。多租户隔离、片段重叠校验、提交版本锁定、审核退回都在后端完成。

---

## 快速开始

```bash
npm install
npm run dev          # http://localhost:3000
```

首次启动会自动建库并写入演示数据：2 个租户、8 名成员、22 个任务、1 段 42 分钟的 Push-T 视频（96×96 原片已转码为 H.264 288×288，约 9.6 MB）。

环境要求：Node.js ≥ 20。生产构建 `npm run build && npm start`。

```bash
npm run reset        # 清空数据库，下次启动重新播种
npm run smoke        # 25 项业务规则冒烟测试（需先启动服务）
```

### 演示账号

| 角色 | 邮箱 | 密码 | 租户 |
| --- | --- | --- | --- |
| 租户管理员 | `admin@xingye.ai` | `demo1234` | 星野机器人 |
| 标注员 | `anna@xingye.ai` | `demo1234` | 星野机器人 |
| 标注员 | `bo@xingye.ai` | `demo1234` | 星野机器人 |
| 标注员 | `chen@xingye.ai` | `demo1234` | 星野机器人 |
| 租户管理员 | `admin@chaoxi.ai` | `demo1234` | 潮汐智造 |
| 标注员 | `ding@chaoxi.ai` | `demo1234` | 潮汐智造 |
| 平台管理员 | `ops@platform.ai` | `demo1234` | 跨租户 |

登录页点任意账号可自动填入，登录后标注员直接进入工作台。

---

## 截图

### 标注工作台

标注员每天要盯着用的界面：时间轴 + 逐帧 + 打点 + 右侧片段检查器。

**深色**

![标注工作台](docs/screenshots/studio.png)

**浅色**

![标注工作台浅色](docs/screenshots/studio-light.png)

**打点中**：按 `N` 打起点 → 移动播放头 → 再按 `N` 确认，时间轴上实时显示虚线区间与长度

![打点](docs/screenshots/studio-marking.png)

**任务切换**：点标题直接换任务，不用退出工作台

![任务切换](docs/screenshots/studio-switcher.png)

**被退回的任务**：顶部横幅显示退回原因，片段保留为草稿可继续改

![退回](docs/screenshots/studio-rejected.png)

### 管理端

**概览**：今日有效时长、待审核、进行中、待领取、14 天趋势、标注员排行

![概览](docs/screenshots/dashboard.png)

**任务**：视频首帧作缩略图，可按待领取 / 进行中 / 待审核 / 已通过 / 已退回筛选

![任务](docs/screenshots/tasks.png)

**待审核筛选**

![待审核](docs/screenshots/tasks-pending.png)

**审核**：通过 / 退回，退回必须填原因

| | |
| --- | --- |
| ![待审核详情](docs/screenshots/review-pending.png) | ![退回弹窗](docs/screenshots/review-reject-modal.png) |

**任务详情**：只读时间轴回看片段，右侧是有效时长与审核结论

![任务详情](docs/screenshots/task-detail.png)

**工作量统计**：按日、按人、按任务，可导出 CSV

![统计](docs/screenshots/stats.png)

| | |
| --- | --- |
| ![团队](docs/screenshots/team.png) | ![视频库](docs/screenshots/videos.png) |

### 标注员

| | |
| --- | --- |
| ![任务大厅](docs/screenshots/hall.png) | ![我的任务](docs/screenshots/my-tasks.png) |

### 其他

| | |
| --- | --- |
| ![登录](docs/screenshots/login.png) | ![登录深色](docs/screenshots/login-dark.png) |
| ![工作台入口](docs/screenshots/studio-index.png) | ![深色任务](docs/screenshots/tasks-dark.png) |
| ![深色概览](docs/screenshots/dashboard-dark.png) | |

---

## 项目介绍

### 它解决什么问题

机器人示教数据需要人工从长视频里挑出「有用的动作片段」。原来标注员把起止时间填进表格、管理员每天手工汇总，数字经常对不上。这个系统把整条链路搬进浏览器：

- 标注员在**时间轴**上圈出片段，系统自动算有效时长
- 管理员**审核**提交结果，不通过就退回重标
- 有效时长按**提交日期**归集，随时可查、可导出

### 角色与流程

```mermaid
flowchart LR
  A["管理员创建任务"] --> B["标注员领取"]
  B --> C["时间轴打点 / 逐帧标注"]
  C --> D["提交"]
  D --> E{"管理员审核"}
  E -->|通过| F["终态<br/>工时计入提交当天"]
  E -->|退回·需填原因| C
```

- **标注员**：只能看到本租户的任务，只能改自己领取的任务
- **租户管理员**：发布任务、审核、看统计，只能看本租户
- **平台管理员**：跨租户，发布任务时可指定租户

### 功能清单

**标注工作台**

- 时间轴：自适应刻度尺、可拖拽播放头、片段块拖拽 / 两端裁剪、空白处拖拽新建、缩放滑杆、Ctrl+滚轮缩放、吸附（帧 + 相邻片段边界）
- 逐帧：`←` / `→` 单帧步进，`Shift + ←/→` 跳 1 秒，时间码 `HH:MM:SS:FF`；帧率自动检测（`requestVideoFrameCallback` 采样），可手动切换
- 打点：`N` 两段式（起点 → 移动 → 确认），`Esc` 取消
- 片段编辑：毫秒级起止、标签、定位、分割 `S`、复制 `⌘D`、删除 `⌫`、设为起点/终点 `I`/`O`
- 实时校验：重叠标红并阻止保存与提交，超时长 / 过短同样拦截
- 自动保存：停止编辑 1.1 秒落库，切换任务前补存一次
- 播放控制：首尾跳转、0.25×–2× 变速、音量、全屏
- 长视频：默认视野约 2 分钟，打开时自动跳到第一个片段

**管理端**

- 概览：今日 / 近 7 天、待审核、进行中、待领取、14 天柱状图、标注员排行、最近提交
- 任务：筛选、搜索、创建（选视频或现场上传、可指派或投放大厅）、详情回看、删除
- 审核：通过 / 退回（必填原因），退回后版本作废、工时移除
- 统计：日期区间与标注员筛选、每日明细、按人汇总、提交明细、CSV 导出（汇总 / 片段明细）
- 团队与租户：成员管理、停用启用、租户数据概览
- 视频库：流式上传（支持 500 MB+）、时长回填、占用检查后删除

**标注员端**

- 任务大厅：本租户可领取任务，原子领取（两人同时点只有一个成功）
- 我的任务：进行中（草稿进度）+ 已提交（时长、计入日期）

### 界面

整套 UI 直接沿用 **OpenCut 的设计系统**（[opencut-app/opencut](https://github.com/opencut-app/opencut) 的 `apps/web`）：`styles.css` 的 token 与 `components/ui/*` 组件原样搬进 `components/shadcn/`，`components/ui.tsx` 只做一层薄适配。

- token：oklch 中性色，`--radius: 0.625rem` 派生 sm/md/lg/xl
- 控件：按钮 `h-7 / text-xs`、输入 `h-7`、徽标 `h-5 rounded-full`、卡片 `rounded-lg ring-1 ring-foreground/10`
- 浅色 / 深色：右上角切换，默认跟随系统，localStorage 记忆，首屏前注入避免闪白

---

## 架构

```mermaid
flowchart TB
  subgraph client["浏览器"]
    direction LR
    ui["管理端 / 标注员列表页<br/>React Server Components"]
    studio["标注工作台<br/>Client Components + HTML5 Video"]
  end

  subgraph server["Next.js Route Handlers（单进程）"]
    api["鉴权 · 租户校验 · 片段校验<br/>事务提交 · 审核 · 统计 · CSV"]
    lib["lib/queries 读模型<br/>lib/segments 片段规则<br/>lib/auth 会话与租户作用域"]
  end

  db[("SQLite（WAL）<br/>6 张业务表 + 审计表")]
  fs[("storage/videos<br/>本地对象存储")]

  ui -->|"REST / JSON<br/>Cookie 会话"| api
  studio -->|"REST + Range 分片"| api
  api --> lib
  lib --> db
  api -->|"流式读写"| fs
```

**为什么是模块化单体**：核心难点在业务规则一致性（区间不重叠、提交即锁定、统计口径）和视频交互，不在横向扩展。单进程 + SQLite 事务足以保证正确性，也便于本地一键运行。

### 目录

```
app/
  (workspace)/          管理端与标注员列表页（顶栏导航）
    dashboard/ tasks/ stats/ team/ videos/ hall/ my-tasks/ studio/
  annotate/[id]/        标注工作台（全屏，独立布局）
  api/                  REST 接口
components/
  shadcn/               OpenCut 原版组件（Button/Card/Dialog/Badge/…）
  studio/               TimelineEditor · StudioWorkspace · useVideoFps
  ui.tsx                组件适配层 + 页面骨架
lib/
  db.ts                 better-sqlite3 单例、建表、迁移、播种
  queries.ts            读模型
  segments.ts           服务端片段校验
  segment-utils.ts      前后端共用的重叠检测
  auth.ts api.ts        会话、鉴权、错误规范
  timecode.ts           帧 / 时间码换算
scripts/                reset · smoke
```

### 数据模型

```mermaid
erDiagram
  TENANTS ||--o{ USERS : 包含
  TENANTS ||--o{ VIDEOS : 拥有
  TENANTS ||--o{ TASKS : 拥有
  VIDEOS ||--o{ TASKS : 引用
  USERS ||--o{ TASKS : 领取
  TASKS ||--o{ SEGMENTS : 草稿
  TASKS ||--o{ SUBMISSIONS : 版本
  USERS ||--o{ SUBMISSIONS : 提交
  TENANTS ||--o{ AUDIT_LOGS : 记录
```

| 表 | 作用 | 关键字段 |
| --- | --- | --- |
| `tenants` | 租户 | `slug` |
| `users` | 成员 | `role`（SUPER_ADMIN/ADMIN/ANNOTATOR）、`status` |
| `videos` | 视频元数据 | `storage_key`、`duration` |
| `tasks` | 标注任务 | `status`、`assignee_id`、`submitted_at`、`submitted_date`、`review_status` |
| `segments` | 当前片段（草稿即最终结果） | `start_time`、`end_time` |
| `submissions` | 提交版本快照 | `version`、`is_current`、`total_duration`、`segments_json` |
| `audit_logs` | 关键操作 | `action`、`entity_id` |

`submissions` 上有一个部分唯一索引 `(task_id) WHERE is_current = 1`，从数据库层面保证「一个任务只有一个有效版本」，统计永远不会重复计数。

---

## 关键规则怎么落地

**片段不重叠**（`lib/segments.ts`）
左闭右开区间，排序后相邻比较 `next.start < prev.end` 即冲突，因此 `10–20` 与 `20–30` 合法相邻。校验同时覆盖负值、零长度、短于 0.1 秒、超出视频时长。前端只做提示，**保存与提交都以服务端校验为准**。

**有效时长 = 已提交任务的片段之和**
统计只读 `submissions`（`is_current = 1`）的 `total_duration`，不读 `segments` 表——草稿永远不计入。`submitted_date` 在提交事务里按业务时区（默认 `Asia/Shanghai`，可用 `BIZ_TZ` 覆盖）写入，统计按它分组，因此「跨零点提交」不会算错日期。

**提交 → 审核 → 通过 / 退回**
提交在 `BEGIN IMMEDIATE` 事务里完成：覆盖草稿 → 旧版本 `is_current = 0` → 插入新版本 → 任务置为 `SUBMITTED` 且 `review_status = PENDING`。之后只有管理员能处理：

- **通过**：`review_status = APPROVED`，版本保持有效，工时留在提交当天，任务进入终态
- **退回**：作废当前版本、任务回到 `IN_PROGRESS`、记录退回原因；工时同步移除，标注员改完重新提交（版本 +1，再次进入待审核）

审核状态独立于任务状态（`review_status` 列），所以「待审核 / 已通过」不会和「进行中 / 已提交」混在一个字段里。

**多租户隔离**
租户身份只来自签名 Cookie 里的会话，绝不接受前端传入的 `tenant_id` 作为授权依据。所有查询先取 `tenantScope(user)`；跨租户访问统一返回 **404**（而非 403），避免用状态码探测其他租户的数据。视频流接口每次请求都校验租户归属。

**并发领取**
`UPDATE tasks SET ... WHERE id = ? AND status = 'AVAILABLE' AND assignee_id IS NULL`，检查 `changes === 1`，在事务内原子完成，两人同时点只有一个成功。

**视频存储**
文件落在 `storage/videos/`，数据库只存 `storage_key`。上传走原始字节流（非 multipart），避免大文件读进内存；播放接口支持 HTTP Range，可任意拖动进度条。时长由浏览器读取元数据后回填，服务端不依赖 ffmpeg。

---

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/login` `/logout` | 登录 / 退出 |
| GET | `/api/tasks?scope=hall\|mine\|all` | 任务列表（按角色与租户过滤） |
| POST | `/api/tasks` | 创建任务（管理员） |
| GET/PATCH/DELETE | `/api/tasks/:id` | 详情 / 编辑 / 删除 |
| POST | `/api/tasks/:id/claim` | 领取（原子） |
| GET/PUT | `/api/tasks/:id/segments` | 读取 / 保存草稿 |
| POST | `/api/tasks/:id/submit` | 提交（校验 + 版本 + 锁定） |
| POST | `/api/tasks/:id/review` | 审核：通过 / 退回（退回需填原因） |
| GET/POST | `/api/videos` | 视频列表 / 流式上传 |
| GET | `/api/videos/:id/stream` | 带 Range 的受权视频流 |
| PATCH/DELETE | `/api/videos/:id` | 回填时长 / 删除 |
| GET | `/api/stats/daily` | 区间统计（按天、按人、按任务） |
| GET | `/api/export?type=tasks\|segments` | CSV 导出（带 BOM） |
| GET/POST/PATCH | `/api/admin/users` `/tenants` | 成员与租户管理 |

错误统一为 `{ error, code, details? }`，`code` 用于前端定位（如 `SEGMENT_OVERLAP`、`CONFLICT`）。

---

## 已知限制

- 单进程 SQLite，适合单机 / 小团队；多实例部署需要换 Postgres 并把领取、提交的锁换成行锁
- 审核只有「通过 / 退回」两档，没有多人会签、质检抽样、审核历史时间线
- 上传为整文件流式写入，未做分片续传与断点恢复
- 移动端只做了基础适配，标注工作台面向桌面
- 无单元测试，验证依靠 `npm run smoke` 与浏览器交互脚本（见 `report.md`）

---

## 致谢

- **UI**：`components/shadcn/*` 与 `app/globals.css` 的设计 token 来自 [OpenCut](https://github.com/opencut-app/opencut)（MIT），仅修改了导入路径，未改动组件样式
- **演示视频**：LeRobot 的 Push-T 样本，原片 96×96 / 10fps / 42 分钟，已转码为 H.264 288×288
