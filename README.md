# 庭院设计百宝箱

面向庭院业主、景观设计师及工程人员的纯前端规划工具，可完成庭院空间配比、苗木数量、铺装材料和工程造价的快速估算。

## 功能

- 庭院总面积与绿化、铺装、水景/构筑物比例联动
- 规则式种植苗木数量及损耗估算
- 铺装采购面积、整砖数量、砂浆量估算
- 可编辑工程造价清单，自动计算预备费、税金和单方造价
- 本地自动保存、CSV 导出、打印方案、深色模式
- 响应式布局，支持手机与电脑

## 在线使用

启用 GitHub Pages 后访问：`https://<scrubbed-url-domain>/courtyard-planner/%60

## 部署

仓库已包含 GitHub Actions 工作流。进入仓库 **Settings → Pages**，将 **Build and deployment → Source** 设为 **GitHub Actions**。之后推送到 `main` 分支会自动部署。

## 本地运行

这是无依赖的静态网页，可直接打开 `index.html`，也可以运行：

```bash
python3 -m http.server 8080
```

然后访问 `<scrubbed-url-domain>

## 说明

计算结果用于方案阶段快速比选。正式施工与预算应结合施工图、现场条件、现行计价依据及当地市场询价复核。

## License

MIT