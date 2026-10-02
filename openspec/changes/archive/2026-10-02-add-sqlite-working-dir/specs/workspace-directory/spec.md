# workspace-directory 规格（delta）

## Purpose

定义应用工作目录的解析规则与目录布局，使日志、数据库、配置统一归属用户指定盘符下的固定位置，并在目标盘不可用时保证应用仍可运行。

## ADDED Requirements

### Requirement: 默认工作目录解析
系统 SHALL 在启动时将工作目录解析为 `D:\MyWinApp`；当环境变量 `MYWINAPP_WORKDIR` 已设置时 MUST 使用其值作为工作目录。

#### Scenario: 默认解析
- **WHEN** 未设置 `MYWINAPP_WORKDIR` 且 D 盘可用时启动应用
- **THEN** 工作目录为 `D:\MyWinApp`

#### Scenario: 环境变量覆盖
- **WHEN** 设置 `MYWINAPP_WORKDIR=E:\Data\App` 后启动应用
- **THEN** 工作目录为 `E:\Data\App`

### Requirement: 子目录布局
系统 SHALL 确保工作目录下存在 `logs/`、`data/`、`config/` 三个子目录，并在启动时自动创建缺失的目录。

#### Scenario: 首次启动建立布局
- **WHEN** 工作目录及其子目录均不存在时启动应用
- **THEN** `logs/`、`data/`、`config/` 三个子目录全部被创建

### Requirement: 不可用回落
当默认工作目录无法创建或写入时，系统 SHALL 回落到 Electron `userData` 目录作为工作目录，且 MUST 在回落位置留有可发现的记录。

#### Scenario: D 盘不可用时回落
- **WHEN** `D:\MyWinApp` 无法创建（如 D 盘不存在）时启动应用
- **THEN** 工作目录回落为 `userData`，且回落事实可在 `userData` 下的日志中找到

### Requirement: 日志写入工作目录
主进程 SHALL 将运行日志追加写入 `{工作目录}/logs/app.log`。

#### Scenario: 日志落位
- **WHEN** 应用运行并产生日志事件
- **THEN** `{工作目录}/logs/app.log` 追加对应日志行

#### Scenario: 回落时的日志位置
- **WHEN** 工作目录已回落为 `userData` 后应用产生日志
- **THEN** 日志写入 `{userData}/logs/app.log`
