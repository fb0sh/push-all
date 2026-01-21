# Push-All

一个基于 WebSocket 的实时消息推送系统，包含后端服务器和桌面客户端。

## 功能特性

- 🚀 实时消息推送（WebSocket）
- 💾 消息持久化存储（SQLite）
- 🔔 桌面通知
- 🔍 消息搜索与过滤
- 📨 支持多种消息级别样式
- 🎨 基于 Primer Design System 的现代化 UI

<img width="1212" height="673" alt="image" src="https://github.com/user-attachments/assets/93260040-3160-44ee-87f0-3d46eb39ef80" />


<img width="500" height="700" alt="image" src="https://github.com/user-attachments/assets/90b1166f-fedd-4964-8cb1-760eaf7022e9" />




<img width="1125" height="222" alt="image" src="https://github.com/user-attachments/assets/7092f5f9-8316-47c2-95ab-7d0b0a90de08" />


## 项目结构

```
push-all/
├── push-all-server/      # Rust 后端服务器
├── push-all-display/     # Tauri + React 桌面客户端
└── Cargo.toml           # Rust 工作空间配置
```

## 安装

### 安装服务器

```bash
cargo install push_all_server
```

## 快速开始

### 1. 启动服务器

```bash
cd push-all-server
cargo run
```

服务器默认运行在 `http://127.0.0.1:3000`

### 2. 启动桌面客户端

```bash
cd push-all-display
pnpm install
pnpm tauri dev
```

## API 使用

### WebSocket 连接

```bash
websocat "ws://127.0.0.1:3000/ws?token=abc"
```

### 推送消息

#### 简单推送

```bash
curl "http://127.0.0.1:3000/push?token=abc" -d "msg=123"
```

#### 完整参数推送

```bash
curl "http://127.0.0.1:3000/push?token=abc" \
  -d "msg=hello" \
  -d "pusher=b0sh" \
  -d "type=info" \
  -d "level=info" \
  -d "date=$(date)"
```

### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `token` | string | 是 | 认证令牌 |
| `msg` | string | 是 | 消息内容 |
| `pusher` | string | 否 | 推送者名称 |
| `type` | string | 否 | 消息类型 |
| `level` | string | 否 | 消息级别（影响样式） |
| `date` | string | 否 | 消息日期 |

### 消息级别

`level` 参数支持以下值，用于控制消息显示样式：

- `critical` - 严重错误
- `info` - 信息提示
- `success` - 成功消息
- `upsell` - 推广消息
- `warning` - 警告消息

## 技术栈

### 后端 (push-all-server)

- **Rust** - 系统编程语言
- **Axum** - Web 框架
- **Tokio** - 异步运行时
- **Serde** - 序列化/反序列化

### 前端 (push-all-display)

- **Tauri** - 跨平台桌面应用框架
- **React 19** - UI 框架
- **TypeScript** - 类型安全
- **Primer React** - GitHub 的设计系统
- **Tailwind CSS** - CSS 框架
- **SQLite** - 本地数据库

## 开发环境要求

- Rust 1.80+
- Node.js 18+
- pnpm 8+

## 许可证

MIT
