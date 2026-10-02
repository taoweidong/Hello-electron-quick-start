# sqlite-storage 规格（delta）

## Purpose

提供基于 SQLite 的本地数据存储实例：主进程持有工作目录下的 `data/app.db`，通过 IPC 暴露配置读写能力，渲染层以设置页示例演示完整读写链路，作为后续数据功能的可复用底座。

## ADDED Requirements

### Requirement: SQLite 数据库文件归属
主进程 SHALL 在启动时打开（必要时创建）位于 `{工作目录}/data/app.db` 的 SQLite 数据库，并在整个运行期间复用同一连接。

#### Scenario: 数据库建立
- **WHEN** 应用首次在某一工作目录下启动
- **THEN** `{工作目录}/data/app.db` 被创建，且可被后续启动复用

### Requirement: 配置读写通道
系统 SHALL 提供配置读取与写入两个 IPC 通道，读写 `settings` 键值表（键为主键、值为文本）；读取不存在的键 MUST 返回空值而非抛错。

#### Scenario: 写入后读取一致
- **WHEN** 写入配置项 `theme = dark` 后读取 `theme`
- **THEN** 返回 `dark`

#### Scenario: 读取不存在的键
- **WHEN** 读取从未写入过的配置键
- **THEN** 返回空值，应用不报错

### Requirement: 配置持久性
通过写入通道保存的配置 SHALL 在应用完全退出并重新启动后仍可读取。

#### Scenario: 重启后数据仍在
- **WHEN** 写入某配置后退出应用并重新启动
- **THEN** 读取该配置仍返回先前写入的值

### Requirement: 设置页示例
设置页 SHALL 展示当前工作目录，并提供至少一个配置项的读取与保存操作，其数据 MUST 落在 `settings` 表。

#### Scenario: 设置页保存配置
- **WHEN** 用户在设置页修改配置项并保存
- **THEN** `settings` 表对应键值更新，页面给出保存成功提示
