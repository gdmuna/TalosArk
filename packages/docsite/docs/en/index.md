---
layout: home

hero:
  name: TalosArk
  text: 后端开发基线模板
  tagline: 认证系统、分层架构、CI 流水线、容器化部署、结构化日志，开箱即用

  actions:
    - theme: brand
      text: 什么是 NestJS Scaffold？
      link: /guide/introduction
    - theme: alt
      text: 快速开始
      link: /guide/quick-start
    - theme: alt
      text: Github
      link: https://github.com/gdmuna/NestJS-Scaffold
      target: _blank
      rel: "noopener noreferrer"
  image:
    src: /img/logo-shadowed-cut.png
    alt: NestJS

features:
  - icon: 🔐
    title: JWT ES256 双令牌认证
    details: Access Token（短期）+ Refresh Token（HttpOnly Cookie），支持令牌静默轮换，密钥基于椭圆曲线算法生成。
  - icon: 🏗️
    title: 严格分层架构
    details: Controller → Service → Repository (Prisma)，IoC 容器依赖注入，横切关注点通过 AOP 装饰器机制统一实现。
  - icon: 🔎
    title: 结构化可观测性
    details: Pino JSON 日志 + AsyncLocalStorage 链路追踪，请求 ID 贯穿完整调用链；慢请求与慢查询自动分级告警。
  - icon: 🛡️
    title: 类型安全的异常体系
    details: 'Owner-local native errors preserve their causes; explicit mappings and Zod validation publish safe errors through separate HTTP and WebSocket adapters.'
  - icon: 📦
    title: 完整 CI/CD 流水线
    details: 10 个 GitHub Actions 工作流，覆盖特性开发、集成测试、版本发布、Docker 镜像构建与自动打 Tag。
  - icon: 📖
    title: OpenAPI 自动富化
    details: '@ApiRoute 装饰器自动生成认证策略声明、成功响应包络、错误码示例，Scalar 交互式文档内嵌镜像。'
---
