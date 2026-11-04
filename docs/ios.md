# MusicFree iOS

此分支以 iOS 为目标，最低部署版本为 iOS 15.1。保留 MusicFree 的插件、歌单、搜索、主题和歌词业务，播放器使用现有的 React Native Track Player 4.1.1。

需要 macOS、完整 Xcode、Node.js、Watchman，以及 Ruby/Bundler/CocoaPods。项目通过 `.nvmrc` 固定 Node.js，通过 `.ruby-version` 固定 Ruby 3.3.12。Watchman 用于 Metro 文件监听，避免 Node 默认监听器出现 `EMFILE` 错误。

```sh
brew install rbenv ruby-build watchman
eval "$(rbenv init - zsh)"
rbenv install -s "$(cat .ruby-version)"
nvm install
nvm use
npm ci
bundle install
bundle exec pod install --project-directory=ios
npm start
```

如果尚未配置 rbenv，将 `eval "$(rbenv init - zsh)"` 加到 `~/.zshrc`，让新终端也能自动选择项目 Ruby。Ruby 3.3 自带 Bundler，执行 `bundle install` 前可用 `ruby -v` 和 `which ruby` 检查：应显示 Ruby 3.3.12，路径应指向 rbenv 的 shim，而不是 `/usr/bin/ruby`。

如果 `bundle install` 报 `json` 的 `extconf failed`，并且日志路径包含 `vendor/bundle/ruby/2.6.0` 或提示缺少 `ruby/config.h`，说明仍在使用 macOS 系统 Ruby。执行上面的 rbenv 初始化和安装命令后重试 `bundle install`。Node.js 的 `nvm use` 不会切换 Ruby；无需对系统 Ruby 执行 `sudo gem install`。

另开终端运行：

```sh
npm run ios
```

仓库的 `.nvmrc` 固定为已验证的 Node.js `18.20.8`，因此进入目录后可以直接运行 `nvm use`。指定模拟器和 Debug 配置时，可在 Metro 已运行的情况下使用：

```sh
npm run ios -- --simulator="iPhone 16e (18.6)" --mode Debug --no-packager
```

也可以打开 `ios/MusicFree.xcworkspace`，选择 `MusicFree` scheme 后运行。真机需在 Xcode 的 Signing & Capabilities 中选择自己的开发团队，必要时修改 Bundle Identifier。不要打开 `.xcodeproj` 代替 workspace。

本地音乐通过“本地音乐 → 导入音乐”选择文件，可以多选。文件会从选择器缓存复制到应用 Documents 下的 `imported_music`，清理缓存不会删除已导入歌曲。也可以从系统“文件”应用使用 MusicFree 打开音频文件。下载保存在 Documents 下的 `download/music`；备份通过系统分享面板导出，再通过文件选择器恢复。

iOS 支持后台音频、锁屏播放控制、音频中断恢复和睡眠定时。定时到达后停止播放；启用“播放完当前歌曲”时，在当前歌曲结束后停止。悬浮歌词、回到桌面、强制退出和上游 APK 更新入口在 iOS 中隐藏或禁用。

本地标题、歌手、专辑、时长、封面与内嵌歌词由 AVFoundation 读取；时长保持现有 JS 接口的毫秒单位。不支持修改音频内嵌标签。WMA、APE、OGG、FLAC 等格式的实际可播放性由 iOS/AVPlayer 与具体文件决定；本分支尚未引入 LX 的 libFLAC 播放引擎。

Podfile 固定使用旧架构，以兼容 MMKV v2、FastImage 和当前播放器。`Podfile.lock` 固定原生依赖。HTTP 插件和音源通过 ATS 配置放行；相册仅在保存封面时申请添加照片权限。

验证命令：

```sh
npx tsc --noEmit
npm test -- --runInBand
xcodebuild -workspace ios/MusicFree.xcworkspace -scheme MusicFree \
  -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO ARCHS=arm64 build
```

`MusicFreeTests` 原生测试覆盖音频时长单位和批量元数据对缺失文件的处理，可从 Xcode 执行 Product → Test。GitHub Actions 的 `iOS build` 工作流负责 TypeScript、JS 回归测试和模拟器 Release 构建。设备签名、TestFlight 与 App Store 分发需要单独配置。

适配参考了本地 LX Music Mobile iOS 分支的文件导入、原生能力检查和 AVFoundation 元数据读取方式。该项目使用 Apache-2.0；本分支没有引入它的 Track Player fork、音效补丁或 libFLAC 引擎。
