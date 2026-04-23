# Enterprise KB - 企业知识库

基于 [RAGFlow](https://github.com/infiniflow/ragflow) 的企业级智能知识管理与 AI 对话系统，使用 Next.js 14 构建。

## 功能特性

- **知识库管理** — 创建/删除知识库，上传 PDF/Word/文本等文档，触发解析与向量化
- **AI 智能对话** — 流式问答，基于 RAGFlow 检索增强生成（RAG），支持多轮会话
- **GraphRAG** — 支持图谱化知识检索
- **文件夹 & 收藏夹** — 对知识库文档进行分类整理与收藏
- **回收站** — 软删除文档，支持恢复
- **课程培训** — 创建带测验题的培训课程，追踪学习进度
- **SOP 知识页** — 标准操作流程知识聚合页
- **内容导入** — 支持微信公众号文章、音频文件自动导入知识库
- **LinkBox** — 外部链接收藏与管理
- **用户系统** — JWT 认证，多级权限（普通用户 / 管理员），管理后台

## 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | Next.js 14 (App Router) |
| UI 样式 | Tailwind CSS |
| 语言 | TypeScript |
| 认证 | JWT（jose）+ HttpOnly Cookie |
| AI 后端 | RAGFlow（Docker 部署） |
| 存储 | 文件系统 JSON（用户/进度/收藏数据） |

## 快速开始

### 前置条件

- Node.js 18+
- 已运行的 [RAGFlow](https://github.com/infiniflow/ragflow) 实例

### 安装

\`\`\`bash
git clone https://github.com/wangqioo/enterprise-kb.git
cd enterprise-kb
npm install
\`\`\`

### 环境配置

在项目根目录创建 `.env.local`：

\`\`\`env
# RAGFlow 实例地址
RAGFLOW_BASE_URL=http://localhost:8085

# RAGFlow API Key（在 RAGFlow 管理界面获取）
RAGFLOW_API_KEY=your-ragflow-api-key

# JWT 签名密钥（自定义复杂字符串）
JWT_SECRET=your-jwt-secret-here

# 注册管理员账号时需要的校验码
ADMIN_REGISTER_KEY=your-admin-key

# 微信/音频导入服务地址（可选）
HUB_URL=http://localhost:8096
\`\`\`

### 启动

\`\`\`bash
# 开发模式
npm run dev

# 生产构建
npm run build
npm start
\`\`\`

默认在 `http://localhost:3009` 运行。

## 默认账号

首次启动会自动在 `data/users.json` 创建默认账号：

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin2026 | 管理员 |
| user | user2026 | 普通用户 |

> 建议首次登录后立即修改密码。

## 权限说明

| 权限级别 | 说明 |
|---------|------|
| 0 | 普通用户，只读访问 |
| 1 | 可上传内容、导入文章 |
| 2 | 管理员，全部权限 |

## 项目结构

\`\`\`
enterprise-kb/
├── app/
│   ├── api/                # Next.js API Routes
│   │   ├── auth/           # 登录 / 登出 / 注册
│   │   ├── datasets/       # 知识库 CRUD、文档管理
│   │   ├── chat/           # 对话、流式输出、会话管理
│   │   ├── courses/        # 培训课程
│   │   ├── ingest/         # 微信/音频导入
│   │   └── ...
│   ├── library/            # 知识库页面
│   ├── chat/               # AI 对话页面
│   ├── training/           # 培训模块
│   ├── sop/                # SOP 知识页
│   ├── linkbox/            # LinkBox 页面
│   └── admin/              # 管理后台
├── components/             # 公共组件（NavBar、Sidebar）
├── lib/
│   ├── auth.ts             # 认证逻辑
│   └── ragflow.ts          # RAGFlow API 封装
├── data/                   # JSON 数据文件（运行时生成）
└── public/                 # 静态资源
\`\`\`

## RAGFlow 部署参考

使用 Docker Compose 快速部署 RAGFlow：

\`\`\`bash
git clone https://github.com/infiniflow/ragflow.git
cd ragflow/docker
docker compose up -d
\`\`\`

默认访问 `http://localhost:80`，创建 API Key 后填入 `.env.local`。

## License

MIT
