# iOS 关键词库工作台

一个本地运行的 iOS ASO 关键词工具：导入多个关键词文件、完全去重、翻译、按搜索量/难度/相关性筛选，并整理出符合苹果规则的 **100 字符关键词字段**。所有词库数据保存在浏览器本地（localStorage），不会上传。

## 功能

- **文件导入**：支持 CSV / TSV / TXT / JSON，自动识别 UTF-8、UTF-16、GBK / GB18030 编码，多文件一次导入并合并完全重复关键词。
- **词库清洗**：可直接编辑关键词与翻译，按搜索量、难度、相关性、应用数排序与筛选。
- **保护词规则**：标题、副标题中出现的英文单词会自动标记为受保护，避免在 100 字符字段里重复占用。
- **100 字符字段**：勾选关键词自动拼装，实时统计字符数并提示超限或包含保护词，可复制/导出。
- **AI 翻译 / AI 分析**（可选）：配置任意 OpenAI 兼容的 Chat Completions 接口后，可批量翻译关键词、分析高频词与 ASO 组合建议。

## 运行

需要 Node.js 18 及以上（推荐 20+）。

```bash
node server.mjs
```

打开 http://localhost:5173 即可使用。可用环境变量 `PORT` 指定端口。

未配置 AI 接口时，导入、去重、筛选、100 字符字段等本地功能全部可用；只有「AI 翻译」和「AI 分析」需要接口。

## 配置 AI 接口（可选）

服务端从环境变量读取，需要同时设置三项才会启用：

| 变量 | 说明 |
| --- | --- |
| `AI_API_URL` | OpenAI 兼容的 chat completions 地址，如 `https://your-provider.example/v1/chat/completions` |
| `AI_API_KEY` | 接口密钥 |
| `AI_MODEL` | 模型名称 |

### Windows

复制 `ai-api.local.bat.example` 为 `ai-api.local.bat`，填入自己的接口信息，然后双击运行 `start.bat`（会先加载配置再启动服务）。`ai-api.local.bat` 已在 `.gitignore` 中，不会被提交。

### macOS / Linux

```bash
export AI_API_URL="https://your-provider.example/v1/chat/completions"
export AI_API_KEY="your-key"
export AI_MODEL="your-model"
node server.mjs
```

## 接口

| 路径 | 方法 | 说明 |
| --- | --- | --- |
| `/api/status` | GET | 返回 AI 接口是否已配置 |
| `/api/translate` | POST | `{ "keywords": ["..."] }` → `{ "translations": { "keyword": "翻译" } }` |
| `/api/ai-analyze` | POST | `{ "title", "subtitle", "rows": [...] }` → `{ "analysis": {...} }` |

## 目录结构

```
server.mjs                后端：静态服务 + AI 接口代理
package.json              npm start -> node server.mjs
start.bat                 Windows 启动脚本（加载本地 AI 配置）
ai-api.local.bat.example  AI 配置模板
public/
  index.html             页面结构
  styles.css             样式
  app.js                 前端逻辑（导入、去重、筛选、100 字符字段）
```
