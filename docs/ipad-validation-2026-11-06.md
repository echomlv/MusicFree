# iPad 适配与验证

本次在已有未提交的 iPad 修改上继续完成，未创建提交。

## 布局规则

- iOS Debug / Release 同时支持 iPhone、iPad；iPad 支持四个方向，未禁用多任务窗口。
- `rpx` 的控件缩放以屏幕短边为基准，上限为 440pt，避免 iPad 上字体、按钮、行高随整屏放大。从分屏启动和运行中进入分屏使用相同缩放。
- 页面宽度由父容器决定；窗口宽度达到 700pt 时，首页和播放页使用双栏。保留手机横屏双栏，窄竖向窗口回到单栏。
- 播放页双栏同时显示封面与歌词，封面按实际剩余空间缩放；高度不足 500pt 时使用紧凑播放控制区。
- 推荐和搜索歌单按列表实际宽度计算列数，每格至少预留 250rpx，封面保持 210rpx。
- 抽屉最大 420pt，对话框最大 560pt，普通弹层最大 750pt。竖屏弹层居中，横屏弹层靠右，避开左右安全区。
- 弹层的百分比高度在组件内部根据当前窗口重新计算，输入弹层受键盘上方可用高度限制。全屏动画和图片预览也响应窗口变化。

## 本轮结果

| 项目 | 结果 |
| --- | --- |
| TypeScript | `npx tsc --noEmit` 通过 |
| 自动测试 | 15 个套件通过，113 项通过，2 项原有跳过 |
| ESLint | 修改的 TS / TSX 文件无错误；保留既有风格和依赖警告 |
| iOS 配置 | plist 和 Xcode 项目校验通过；构建产物 `UIDeviceFamily` 为 `[1, 2]` |
| 原生构建 | Debug / iOS Simulator 构建成功，禁用签名 |
| iPad mini (A17 Pro), iOS 18.6 | 安装启动成功，全屏双栏首页；新建歌单面板、软键盘展开后的输入框和确认按钮可见 |
| iPad Pro 13-inch (M4), iOS 18.6 | 安装启动成功，全屏双栏首页，控件未随屏幕放大 |
| 自动布局回归 | mini / Pro 横竖屏尺寸、窄分屏、窗口不旋转时的尺寸变化、键盘收起/展开、打开中的弹层重排、手机控件尺寸和歌单列数 |

首次验证时，已有 Metro 文件索引未识别新增模块，仍显示旧布局。重启 Metro 并清理缓存后，确认新 bundle 包含 700pt 布局断点和 440pt 控件缩放上限，再进行上述界面检查。

横竖屏和分屏的尺寸规则已通过自动测试；尚未完成真机 Split View / Stage Manager 拖动、旋转动画、实际歌曲封面与歌词的完整视觉验收，也未进行签名 Release 真机安装。

## 复验

```sh
npx tsc --noEmit
npx jest --runInBand
xcodebuild -workspace ios/MusicFree.xcworkspace -scheme MusicFree \
  -configuration Debug -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPad mini (A17 Pro),OS=18.6' \
  -derivedDataPath /tmp/musicfree-ipad-build CODE_SIGNING_ALLOWED=NO
```

构建与检查日志：`/tmp/musicfree-ipad-build.log`、`/tmp/musicfree-ipad-tsc-final.log`、`/tmp/musicfree-ipad-jest-final.log`、`/tmp/musicfree-ipad-eslint-final.json`。
