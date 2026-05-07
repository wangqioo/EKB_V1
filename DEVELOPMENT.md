# EKB_V1 开发与使用详解

## 项目定位

EKB（Enterprise Knowledge Base）是一个 **RAGFlow 的企业前端壳**。RAGFlow 负责底层的 RAG（检索增强生成）引擎，这个项目在其上封装了多用户、权限管理、企业培训等业务功能。

> 一句话：RAGFlow 是引擎，EKB 是驾驶舱。

---

## 1. 技术栈

| 层面 | 技术 |
|------|------|
| 框架 | Next.js 14 (App Router) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS |
| 认证 | JWT (`jose`) + HttpOnly Cookie |
| AI | DeepSeek Chat API（流式 SSE）+ RAGFlow HTTP API |
| 数据存储 | 本地 JSON 文件（无数据库） |
| 外部集成 | RAGFlow（知识库引擎）、OpenClaw（AI Agent）、微信文章导入、音频导入 |

### 为什么依赖这么少？

`package.json` 只有 **6 个生产依赖**（`next`, `react`, `react-dom`, `jose`, `react-markdown`, `remark-gfm`）——没有 ORM、没有数据库驱动、没有状态管理库、没有 CSS 框架包（Tailwind 是 dev dep）。整个项目通过 **JSON 文件** 实现持久化，RAGFlow 负责所有向量搜索和文档存储。

---

## 2. 目录结构

```
EKB_V1/
├── app/
│   ├── layout.tsx             # 根布局（HTML head、全局样式）
│   ├── page.tsx               # 入口：/ → /dashboard 重定向
│   ├── globals.css            # 全局 CSS（Tailwind + 自定义主题色）
│   │
│   ├── api/                   # API 路由（前后端一体）
│   │   ├── auth/              #   认证相关
│   │   │   ├── login/route.ts
│   │   │   ├── register/route.ts
│   │   │   ├── logout/route.ts
│   │   │   └── me/route.ts    #      获取当前用户 / 修改个人信息 / 改密码
│   │   ├── admin/             #   管理后台
│   │   │   └── manage/route.ts
│   │   ├── chat/              #   AI 对话
│   │   │   └── webstream/route.ts
│   │   ├── search/route.ts    #   知识库检索
│   │   ├── datasets/route.ts  #   知识库 CRUD
│   │   ├── folders/route.ts   #   文件夹管理
│   │   ├── favorites/route.ts #   收藏夹
│   │   ├── shared/route.ts    #   共享文档（checkout/checkin）
│   │   ├── courses/route.ts   #   企业培训课程
│   │   ├── training/route.ts  #   培训进度
│   │   ├── linkbox/route.ts   #   外链收藏
│   │   ├── agent/             #   OpenClaw Agent 代理
│   │   │   ├── chat/route.ts
│   │   │   ├── models/route.ts
│   │   │   └── list/route.ts
│   │   ├── ingest/            #   数据导入
│   │   │   └── wechat/route.ts #     微信文章导入
│   │   └── read/route.ts      #   阅读进度
│   │
│   ├── (main)/                # 认证后页面（带 Sidebar）
│   │   ├── layout.tsx         #   布局：Session 检查 + Sidebar
│   │   ├── dashboard/         #   首页仪表盘
│   │   ├── datasets/          #   知识库列表
│   │   ├── dataset/[id]/      #   单个知识库详情
│   │   ├── chat/              #   AI 对话
│   │   ├── agent/             #   AI Agent 页面（iframe 嵌入 OpenClaw）
│   │   ├── courses/           #   培训课程
│   │   ├── sop/               #   SOP 知识聚合
│   │   ├── linkbox/           #   外链收藏
│   │   ├── admin/             #   管理后台
│   │   └── search/            #   全局搜索
│   │
│   └── (auth)/                # 认证页面（无 Sidebar）
│       └── login/page.tsx     #   登录页
│
├── components/
│   ├── Sidebar.tsx            # 主导航（角色感知，折叠/展开）
│   ├── FileUploader.tsx       # 通用文件上传组件
│   ├── DiffText.tsx           # 文本差异比较
│   └── ThinkingBlock.tsx      # AI 推理过程展示
│
├── lib/
│   ├── auth.ts                # 核心：JWT + 用户 CRUD + 权限 + 邀请码
│   ├── ragflow.ts             # RAGFlow API 封装（datasets, docs, chat, retrieval）
│   ├── store.ts               # 内存数据缓存（减少文件读取）
│   ├── shared.ts              # 共享文档层（checkout/checkin 机制）
│   ├── globals.ts             # 全局变量定义
│   ├── ekb-types.ts           # TypeScript 类型定义（Dataset, Doc, Chunk...）
│   └── ekb-utils.tsx          # 工具函数（文件图标、格式化、Markdown 渲染）
│
├── data/                      # 运行时持久化数据（JSON 文件）
│   ├── users.json             # 用户账号
│   ├── datasets.json          # 知识库元数据
│   ├── folders/*.json         # 文件夹结构（按数据集）
│   ├── favorites/*.json       # 收藏夹
│   ├── courses/*.json         # 培训课程
│   ├── trainings/*.json       # 培训进度
│   └── linkboxes/*.json       # 外链收藏
│
├── Dockerfile                 # 多阶段构建，支持 standalone
├── next.config.js             # output: 'standalone'
├── .env.local                 # 环境配置
├── README.md                  # 快速开始
└── DEVELOPMENT.md             # 本文档
```

---

## 3. 认证架构

### JWT 流程

```
用户登录 → 服务端验证 → 签发 JWT → 存入 HttpOnly Cookie
                                            ↓
                        后续请求自动携带 Cookie → 服务端验证 → 获取用户信息
```

- `lib/auth.ts` 中的 `createToken()` 和 `verifyToken()` 使用 `jose` 库
- `getSession()` 从 Cookie 读取 JWT → 验证 → 从 `data/users.json` 加载用户
- 每次请求都读 JSON 文件，确保用户状态即时更新（无需服务重启）

### 用户模型

```typescript
interface User {
  id: string;
  username: string;
  password: string;    // SHA-256 哈希
  role: number;        // 0=只读, 1=可上传, 2=管理员
  name?: string;
  department?: string;
  createdAt: string;
}
```

### 权限体系

| 级别 | 权限 |
|------|------|
| 0 | 浏览、搜索、AI 对话 |
| 1 | 以上 + 上传文档、导入文章 |
| 2 | 全部权限 + 用户管理、系统配置 |

### 注册机制

- 普通用户可自行注册，默认 `role=0`
- 填写 `ADMIN_REGISTER_KEY` 可直接注册为管理员（`role=2`）
- 管理员可通过 `/api/admin/manage` 创建/编辑/删除用户和部门

### 部门管理

- 管理员可以创建/编辑/删除部门
- 用户可分配所属部门
- 部门用于组织管理和权限隔离

### 邀请码系统

- 管理员生成邀请码（单次使用，过期时间）
- 新用户凭邀请码注册可绕过管理员审批
- 邀请码存储在 `data/invite_codes.json`

---

## 4. 数据架构

**所有业务数据存储为本地 JSON 文件**，位于 `/app/data/`（开发时在项目根 `data/`）。

| 文件 | 用途 | 数据结构 |
|------|------|----------|
| `users.json` | 用户账号 | `User[]` |
| `datasets.json` | 知识库元数据 | `Dataset[]` |
| `folders/{datasetId}.json` | 按知识库的文件夹树 | `Folder[]` |
| `favorites/{userId}.json` | 用户收藏的文档 ID 列表 | `{docIds: string[]}` |
| `courses/{courseId}.json` | 课程定义（章节+测验） | `Course` |
| `trainings/{userId}.json` | 用户培训进度 | `{[courseId]: progress}` |
| `linkboxes/{userId}.json` | 用户外链收藏 | `LinkBox[]` |

> **为什么不用数据库？** 项目规模小、数据量少（企业级但用户数通常在几十人）、避免运维复杂度。JSON 文件 + 内存缓存在这个量级完全够用。

### 唯一使用外部存储的地方

所有**文档内容**（PDF、Word 解析后的文本）、**向量嵌入**、**检索索引**——这些都在 RAGFlow 中。EKB 只管元数据。

---

## 5. 数据流

### 文档从上传到可检索

```
用户上传文件
    ↓
/api/datasets → RAGFlow /api/v1/datasets/{id}/documents
    ↓
RAGFlow 解析、分块、向量化
    ↓
用户搜索 → /api/search → RAGFlow retrieval API → 返回相关片段
```

### AI 对话（流式）

```
用户发送消息
    ↓
/api/chat/webstream → DeepSeek Chat API (SSE)
    ↓
服务端逐块解析 reasoning_content → 分离推理过程与最终回答
    ↓
向客户端推送 SSE 流（推理过程用 ThinkingBlock 渲染）
```

### Agent 对话

```
用户在 Agent 页面提问
    ↓
/api/agent/chat → OpenClaw Gateway API
    ↓
OpenClaw 调用工具（搜索、RAGFlow 检索等）
    ↓
流式返回工具调用结果和最终回答
```

---

## 6. 功能模块详解

### 6.1 仪表盘（Dashboard）

位置：`app/(main)/dashboard/DashboardClient.tsx`

- **概览统计**：知识库数量、文档总数、活跃用户
- **最近活动**：最近上传的文档、最近的对话
- **快捷入口**：快速跳转到常用功能
- **自定义组件**：可配置的仪表盘模块

### 6.2 知识库管理（Datasets）

位置：`app/(main)/datasets/` + `app/(main)/dataset/[id]/`

- **列表视图**：展示所有知识库，支持搜索和筛选
- **详情页面**（`dataset/[id]`）：
  - 文档列表：文件名、大小、解析状态、上传者
  - 文件夹管理：创建/删除文件夹，拖拽移动文档
  - 上传文件：支持 PDF、DOCX、TXT、Markdown 等
  - 批量操作：全选、删除、移动到文件夹
- 所有操作通过 `/api/datasets` 路由代理到 RAGFlow

### 6.3 AI 对话（Chat）

位置：`app/(main)/chat/ChatClient.tsx`

- **多会话管理**：新建、切换、删除会话
- **流式输出**：SSE 实时显示 AI 回复，支持中途停止
- **推理过程展示**：用 `ThinkingBlock` 组件渲染 AI 的思考链
- **上下文检索**：自动在对话中注入相关知识库结果
- **Markdown 渲染**：支持代码高亮、表格、数学公式

### 6.4 AI Agent

位置：`app/(main)/agent/AgentClient.tsx`

- 通过 iframe **嵌入 OpenClaw UI**
- 后端 `/api/agent/*` 路由代理到 OpenClaw Gateway
- 支持工具调用：知识检索、网络搜索、代码执行等
- 与主应用使用同一 JWT 认证

### 6.5 企业培训（Courses）

位置：`app/(main)/courses/`

- **课程管理**：创建含多个章节的课程
- **章节内容**：支持 Markdown、图片、外部链接
- **测验题**：选择题/判断题，自动批改
- **进度追踪**：记录每个用户的完成状态和分数
- 数据存储在 `courses/` 和 `trainings/` JSON 文件中

### 6.6 SOP 知识聚合

位置：`app/(main)/sop/`

- 将各类 SOP（标准操作流程）文档集中展示
- 按类别组织，支持全文搜索
- 面向一线员工的知识获取入口

### 6.7 LinkBox 外链收藏

位置：`app/(main)/linkbox/`

- 收藏和管理外部链接
- 支持分类标签、搜索
- 可用于企业内部资源导航

### 6.8 全局搜索

位置：`app/(main)/search/`

- 跨知识库全文搜索
- 调用 RAGFlow retrieval API
- 结果按相关性排序，展示文档片段

### 6.9 管理后台

位置：`app/(main)/admin/`

- 用户管理：列表、创建、编辑、删除、重置密码
- 部门管理：创建/编辑/删除部门
- 邀请码管理：生成/撤销邀请码
- 系统设置：基础配置项

### 6.10 共享文档

位置：`lib/shared.ts`

- **Checkout/Checkin 机制**：防止多人同时编辑
- 文档锁定，记录当前编辑者
- 超时自动释放锁

---

## 7. API 路由总览

共计约 **61 个路由**，全部在 `app/api/` 下。

### 认证（5 个）

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/auth/login` | POST | 登录 |
| `/api/auth/register` | POST | 注册 |
| `/api/auth/logout` | POST | 登出 |
| `/api/auth/me` | GET | 获取当前用户信息 |
| `/api/auth/me` | PUT | 修改密码/个人信息 |

### 知识库（2 个）

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/datasets` | GET | 获取知识库列表 |
| `/api/datasets` | POST | 创建知识库 |
| `/api/datasets` | PUT | 更新知识库 |
| `/api/datasets` | DELETE | 删除知识库 |

### 文档（RAGFlow 代理，约 15 个）

通过 `/api/datasets` 向下派生的子路由（在 `ragflow.ts` 中封装）：

- `GET /api/datasets/{id}/documents` — 文档列表
- `POST /api/datasets/{id}/documents` — 上传文档
- `DELETE /api/datasets/{id}/documents` — 删除文档
- `GET /api/datasets/{id}/documents/{docId}/chunks` — 获取分块
- `PUT /api/datasets/{id}/documents/{docId}/chunks` — 更新分块
- 等等

### 对话（3 个）

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/chat/webstream` | GET | SSE 流式对话（DeepSeek） |
| `/api/chat/history` | GET | 获取对话历史 |
| `/api/chat/sessions` | POST | 创建新会话 |

### Agent（3 个）

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/agent/chat` | POST | Agent 对话（代理到 OpenClaw） |
| `/api/agent/models` | GET | 获取可用模型列表 |
| `/api/agent/list` | GET | 获取 Agent 列表 |

### 检索（1 个）

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/search` | POST | 知识库检索 |

### 文件夹（4 个）

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/folders` | GET | 获取文件夹树 |
| `/api/folders` | POST | 创建文件夹 |
| `/api/folders` | DELETE | 删除文件夹 |
| `/api/folders` | PUT | 更新文件夹/移动文档 |

### 收藏夹（2 个）

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/favorites` | GET | 获取收藏列表 |
| `/api/favorites` | POST | 添加收藏 |
| `/api/favorites` | DELETE | 取消收藏 |

### 共享文档（2 个）

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/shared` | POST | 签出文档（checkout） |
| `/api/shared` | PUT | 签入文档（checkin） |

### 培训课程（4 个）

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/courses` | GET | 获取课程列表 |
| `/api/courses` | POST | 创建课程 |
| `/api/courses` | PUT | 更新课程 |
| `/api/courses` | DELETE | 删除课程 |
| `/api/courses` | GET (with id) | 获取课程详情 |

### 培训进度（3 个）

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/training` | GET | 获取用户培训进度 |
| `/api/training` | POST | 更新进度 |
| `/api/training` | GET (course) | 获取某课程的所有学员进度 |

### LinkBox（3 个）

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/linkbox` | GET | 获取外链列表 |
| `/api/linkbox` | POST | 添加外链 |
| `/api/linkbox` | DELETE | 删除外链 |

### 管理后台（5 个）

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/admin/manage` | GET | 获取用户列表 |
| `/api/admin/manage` | POST | 创建用户 |
| `/api/admin/manage` | PUT | 更新用户 |
| `/api/admin/manage` | DELETE | 删除用户 |
| `/api/admin/invite-codes` | GET/POST | 管理邀请码 |

### 微信文章导入（2 个）

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/ingest/wechat` | POST | 导入微信公众号文章 |
| `/api/ingest/wechat/reply` | POST | 处理微信自动回复 |

### 其他（2 个）

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/dashboard` | GET | 仪表盘统计 |
| `/api/read` | POST | 记录阅读进度 |

---

## 8. 核心模块实现细节

### 8.1 auth.ts（认证中心，~253 行）

这个文件是系统的"心脏"，包含了：

- **JWT 操作**：`createToken()` / `verifyToken()` — 用 jose 的 `SignJWT` 和 `jwtVerify`
- **用户管理**：`getUsers()` / `saveUser()` / `createUser()` / `updateUser()` / `deleteUser()`
- **密码处理**：SHA-256 哈希（`crypto.createHash('sha256')`），没有 bcrypt（减少依赖）
- **会话**：`getSession()` — 每次请求读取 Cookie → 验证 JWT → 从 JSON 加载用户
- **权限**：`requireRole(level)` — 中间件模式，检查当前用户角色
- **部门**：`getDepartments()` / `saveDepartment()` / `createDepartment()`
- **邀请码**：`generateInviteCode()` / `verifyInviteCode()` — 带过期时间

### 8.2 ragflow.ts（RAGFlow API 封装，~130 行）

封装 RAGFlow 的 HTTP API：

- `getDatasets()` / `createDataset()` / `deleteDataset()`
- `getDocuments()` / `uploadDocument()` / `deleteDocument()`
- `getChunks()` / `updateChunk()`
- `retrieveChunks()` — 检索相关块（search 接口调用）
- `createChatSession()` / `sendChatMessage()`
- `getDatasetById()`
- `downloadDocument()`
- `deleteDocuments()`（批量）

所有函数都是 `fetch` 调用，没有额外的 SDK 依赖。

### 8.3 Sidebar.tsx（主导航，~15KB）

功能完整的导航组件：

- **角色感知**：根据 `user.role` 显示/隐藏管理员入口
- **折叠/展开**：可切换图标模式（节省空间）
- **高亮当前**：基于当前路径自动高亮
- **分组**：分成"核心功能"、"管理"、"系统"等区域
- **响应式**：在移动端自动折叠

### 8.4 chat/webstream 路由（关键路由，~6KB）

这个路由是 AI 对话的核心，实现了：

1. 接收用户消息，携带上下文（历史消息 + 检索结果）
2. 调用 DeepSeek Chat API（OpenAI 兼容接口）
3. 逐块解析 SSE 流，提取 `reasoning_content`（推理过程）
4. 将推理过程与最终回答分离
5. 分别推送给前端（前端用 ThinkingBlock 展示推理过程）

关键代码模式：

```typescript
// 提取 DeepSeek 的 reasoning_content
const reasoning = chunk.choices?.[0]?.delta?.reasoning_content || '';
const content = chunk.choices?.[0]?.delta?.content || '';
// 分别推送给前端
encoder.encode(`data: ${JSON.stringify({ type: 'reasoning', content: reasoning })}\n\n`);
encoder.encode(`data: ${JSON.stringify({ type: 'text', content })}\n\n`);
```

### 8.5 agent/chat 路由（OpenClaw 代理，~11KB）

OpenClaw Agent 代理实现了：

1. 接收用户消息
2. 构建 OpenClaw 兼容的请求格式
3. 调用 OpenClaw Gateway API
4. 解析工具调用链（搜索、检索等）
5. 流式返回结果

支持的工具包括：
- `web_search` — 网络搜索
- `rag_retrieve` — 知识库检索
- `calculator` — 计算器
- `current_datetime` — 获取当前时间

### 8.6 前端组件

| 组件 | 位置 | 功能 |
|------|------|------|
| `FileUploader.tsx` | `/components/` | 拖拽上传、多文件、进度条 |
| `DiffText.tsx` | `/components/` | 文本差异对比（版本对比） |
| `ThinkingBlock.tsx` | `/components/` | 折叠式推理过程展示 |
| `DashboardClient.tsx` | `(main)/dashboard/` | 仪表盘（26KB，最复杂的页面） |

---

## 9. 部署

### 环境变量

```env
RAGFLOW_BASE_URL=http://localhost:8085      # RAGFlow 服务地址
RAGFLOW_API_KEY=ekb-api-xxxxxxxxxxxxxxx     # RAGFlow API Key
JWT_SECRET=your-jwt-secret                  # JWT 签名密钥
ADMIN_REGISTER_KEY=your-admin-key           # 管理员注册邀请码
HUB_URL=http://localhost:8096               # 可选：微信/音频导入服务
NEXT_PUBLIC_AGENT_BASE_URL=/api/agent       # Agent API 基础路径
OPENAI_BASE_URL=https://api.deepseek.com    # DeepSeek API 地址
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx      # DeepSeek API Key
```

### Docker 部署

```bash
docker build -t ekb .
docker run -d \
  --name ekb \
  -p 3009:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/.env.local:/app/.env.local \
  ekb
```

### 生产环境架构

```
用户浏览器
    ↓
Nginx 反向代理（HTTPS 443）
    ↓
EKB（端口 3009）  ──→  RAGFlow（端口 8085）
    │
    └──→  OpenClaw Gateway（端口 18789）
```

---

## 10. 外部服务依赖

| 服务 | 用途 | 必需 |
|------|------|------|
| RAGFlow | 知识库引擎、文档解析、向量检索、文档存储 | ✅ |
| DeepSeek API | AI 对话（Chat Completion） | ✅ |
| OpenClaw Gateway | AI Agent 功能（工具调用） | ❌ 可选 |
| 微信导入服务（HUB） | 微信公众号文章自动导入 | ❌ 可选 |

---

## 11. 权限与安全

- **认证方式**：JWT 存储在 HttpOnly Cookie（防止 XSS 窃取）
- **密码存储**：SHA-256 哈希（非明文）
- **API 鉴权**：每个 API 路由调用 `getSession()` 验证身份
- **权限校验**：敏感操作需要 `role >= 2`
- **JWT 过期**：Token 有过期时间（默认 24 小时）
- **邀请码**：单次使用，支持设置有效期

---

## 12. 开发指南

### 本地开发

```bash
npm install
cp .env.local.example .env.local   # 配置环境变量
npm run dev                         # http://localhost:3009
```

### 添加新页面

1. 在 `app/(main)/` 下创建目录，添加 `page.tsx`
2. 如需要后端 API，在 `app/api/` 下创建路由
3. Sidebar 自动高亮（基于路径匹配）
4. 如果需要在导航栏添加入口，修改 `components/Sidebar.tsx`

### 数据流模式

```
页面组件 → fetch(/api/xxx) → API 路由 → lib/*.ts → 数据源
                                                        ↓
                                                    RAGFlow API / JSON 文件
```

### 修改持久层

- 业务元数据 → 修改对应 `lib/*.ts` 中的 JSON 文件读写
- 文档内容/向量 → 调 RAGFlow API（`lib/ragflow.ts`）
- 新增数据文件 → 在 `app/data/` 下新建 JSON，确保 Docker volume 映射

---

## 13. 最近修改记录

| 日期 | 修改内容 |
|------|----------|
| 近期 | 添加 `reasoning_content` 深度思考链支持（DeepSeek 推理过程） |
| 近期 | 增强 Web 搜索能力（集成到 Agent 工具集） |
| 近期 | 统一所有模型引擎为 `deepseek-v4-flash` |
| 近期 | 修复 Docker port 3009 环境变量问题 |
| 近期 | 完善 CSS 变量（新增 `--warning`, `--error`, `--success`） |
| 近期 | 修复文件夹图标显示问题 |
| 近期 | 修复 RAGFlow API Key 在 Docker 构建中的配置 |

---

*本文档由 AI 基于代码仓库自动生成，覆盖了 EKB_V1 项目的完整架构、功能、API、部署和开发指南。*
