# enterprise-kb

RAGFlow 的企业前端壳。RAGFlow 负责 RAG 引擎，这个项目负责多用户、权限管理和业务功能。

## 它做什么

RAGFlow 本身没有多用户、权限分级这些概念。这个项目套在 RAGFlow 外面，提供：

- 用户注册/登录，分三级权限（只读 / 可上传 / 管理员）
- 知识库和文档的增删查，底层调 RAGFlow API
- AI 对话界面，流式输出，支持多 session
- 文件夹、收藏夹、回收站整理文档
- 企业培训模块：课程内容 + 测验题 + 进度记录
- 微信公众号文章、音频文件自动导入知识库
- GraphRAG 支持
- SOP 知识聚合页
- LinkBox 外链收藏
- 管理后台管用户

## 技术栈

- **Next.js 14** App Router + TypeScript + Tailwind CSS
- **认证**：JWT（jose）+ HttpOnly Cookie，用户数据存本地 JSON 文件
- **AI**：调 RAGFlow HTTP API，SSE 流式转发给前端
- **存储**：本地 JSON（users、folders、favorites、courses、progress）
- **外部服务**：微信/音频导入走独立的 HUB_URL 服务

## 前置条件

需要一个跑起来的 RAGFlow 实例。Docker 快速部署：

```bash
git clone https://github.com/infiniflow/ragflow.git
cd ragflow/docker
docker compose up -d
```

然后去 RAGFlow 管理界面拿 API Key。

## 安装

```bash
git clone https://github.com/wangqioo/enterprise-kb.git
cd enterprise-kb
npm install
```

创建 `.env.local`：

```env
RAGFLOW_BASE_URL=http://localhost:8085
RAGFLOW_API_KEY=你的-ragflow-api-key
JWT_SECRET=自定义签名密钥
ADMIN_REGISTER_KEY=管理员注册邀请码

# 可选，微信/音频导入服务
HUB_URL=http://localhost:8096
```

启动：

```bash
npm run dev    # 开发
npm start      # 生产（需先 npm run build）
```

默认端口 3009。

## 默认账号

首次启动自动生成 `data/users.json`，内含两个初始账号：

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin2026 | 管理员 |
| user | user2026 | 普通用户 |

**上线前记得改密码。**

## 权限

| 级别 | 可做什么 |
|------|---------|
| 0 | 浏览、搜索、对话 |
| 1 | 上传文档、导入文章 |
| 2 | 全部权限 + 用户管理 |

注册时填写 `ADMIN_REGISTER_KEY` 可直接注册为管理员。

## License

MIT
