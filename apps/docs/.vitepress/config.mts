import { defineConfig } from "vitepress"

const repositoryUrl = "https://github.com/Revaea/i0c.cc"
const footerMessage = [
  ["Revaea", "https://revaea.com"],
  ["World", "https://story.revaea.com"],
  ["Random Image", "https://api.revaea.com"],
  ["HLS", "https://hls.revaea.com"],
  ["Lab", "https://test.i0c.cc"],
]
  .map(([label, link]) => `<a href="${link}" target="_blank" rel="noopener noreferrer">${label}</a>`)
  .join('<span class="i0c-footer-separator" aria-hidden="true"></span>')

const englishNav = [
  {
    text: "Guide",
    activeMatch: "^/guide/",
    items: [
      { text: "About this project", link: "/guide/getting-started" },
      { text: "Architecture", link: "/guide/architecture" },
      { text: "Instance configuration", link: "/guide/configuration" },
      { text: "Redirect rules", link: "/guide/rules" },
    ],
  },
  {
    text: "Deployment",
    activeMatch: "^/deployment/",
    items: [
      { text: "Choose a topology", link: "/deployment/choose-a-topology" },
      { text: "Deploy the WebUI", link: "/deployment/webui" },
      { text: "Deploy a Runtime", link: "/deployment/runtime" },
      { text: "Choose a database", link: "/deployment/databases" },
    ],
  },
  {
    text: "Operations",
    activeMatch: "^/operations/",
    items: [
      { text: "Database setup", link: "/operations/database" },
      { text: "Troubleshooting", link: "/operations/troubleshooting" },
    ],
  },
  {
    text: "Plugins",
    activeMatch: "^/plugins/",
    items: [
      { text: "Plugin architecture", link: "/plugins/architecture" },
      { text: "Plugin SDK", link: "/plugins/sdk" },
      { text: "Write an adapter", link: "/plugins/adapters" },
    ],
  },
  {
    text: "Reference",
    activeMatch: "^/reference/",
    items: [
      { text: "Analytics semantics", link: "/reference/analytics" },
      { text: "Environment bindings", link: "/reference/environment" },
      { text: "Commands", link: "/reference/commands" },
    ],
  },
  { text: "Instance", link: "https://u.i0c.cc" },
]

const chineseNav = [
  {
    text: "指南",
    activeMatch: "^/zh-CN/guide/",
    items: [
      { text: "了解这个项目", link: "/zh-CN/guide/getting-started" },
      { text: "架构", link: "/zh-CN/guide/architecture" },
      { text: "实例配置", link: "/zh-CN/guide/configuration" },
      { text: "重定向规则", link: "/zh-CN/guide/rules" },
    ],
  },
  {
    text: "部署",
    activeMatch: "^/zh-CN/deployment/",
    items: [
      { text: "选择部署拓扑", link: "/zh-CN/deployment/choose-a-topology" },
      { text: "部署 WebUI", link: "/zh-CN/deployment/webui" },
      { text: "部署 Runtime", link: "/zh-CN/deployment/runtime" },
      { text: "选择数据库", link: "/zh-CN/deployment/databases" },
    ],
  },
  {
    text: "运维",
    activeMatch: "^/zh-CN/operations/",
    items: [
      { text: "数据库初始化", link: "/zh-CN/operations/database" },
      { text: "故障排查", link: "/zh-CN/operations/troubleshooting" },
    ],
  },
  {
    text: "插件",
    activeMatch: "^/zh-CN/plugins/",
    items: [
      { text: "插件架构", link: "/zh-CN/plugins/architecture" },
      { text: "插件 SDK", link: "/zh-CN/plugins/sdk" },
      { text: "编写适配器", link: "/zh-CN/plugins/adapters" },
    ],
  },
  {
    text: "参考",
    activeMatch: "^/zh-CN/reference/",
    items: [
      { text: "统计口径", link: "/zh-CN/reference/analytics" },
      { text: "环境绑定", link: "/zh-CN/reference/environment" },
      { text: "命令索引", link: "/zh-CN/reference/commands" },
    ],
  },
  { text: "实例", link: "https://u.i0c.cc" },
]

const englishSidebar = [
  {
    text: "Start here",
    items: [
      { text: "About this project", link: "/guide/getting-started" },
      { text: "Architecture", link: "/guide/architecture" },
    ],
  },
  {
    text: "Deploy",
    items: [
      { text: "Choose a topology", link: "/deployment/choose-a-topology" },
      { text: "Deploy the WebUI", link: "/deployment/webui" },
      { text: "Deploy a Runtime", link: "/deployment/runtime" },
      { text: "Choose a database", link: "/deployment/databases" },
    ],
  },
  {
    text: "Configure and use",
    items: [
      { text: "Instance configuration", link: "/guide/configuration" },
      { text: "Redirect rules", link: "/guide/rules" },
    ],
  },
  {
    text: "Operate",
    items: [
      { text: "Database setup", link: "/operations/database" },
      { text: "Troubleshooting", link: "/operations/troubleshooting" },
    ],
  },
  {
    text: "Extend",
    items: [
      { text: "Plugin architecture", link: "/plugins/architecture" },
      { text: "Plugin SDK", link: "/plugins/sdk" },
      { text: "Write an adapter", link: "/plugins/adapters" },
    ],
  },
  {
    text: "Reference",
    items: [
      { text: "Analytics semantics", link: "/reference/analytics" },
      { text: "Environment bindings", link: "/reference/environment" },
      { text: "Commands", link: "/reference/commands" },
    ],
  },
]

const chineseSidebar = [
  {
    text: "从这里开始",
    items: [
      { text: "了解这个项目", link: "/zh-CN/guide/getting-started" },
      { text: "架构", link: "/zh-CN/guide/architecture" },
    ],
  },
  {
    text: "部署",
    items: [
      { text: "选择部署拓扑", link: "/zh-CN/deployment/choose-a-topology" },
      { text: "部署 WebUI", link: "/zh-CN/deployment/webui" },
      { text: "部署 Runtime", link: "/zh-CN/deployment/runtime" },
      { text: "选择数据库", link: "/zh-CN/deployment/databases" },
    ],
  },
  {
    text: "配置与使用",
    items: [
      { text: "实例配置", link: "/zh-CN/guide/configuration" },
      { text: "重定向规则", link: "/zh-CN/guide/rules" },
    ],
  },
  {
    text: "运维",
    items: [
      { text: "数据库初始化", link: "/zh-CN/operations/database" },
      { text: "故障排查", link: "/zh-CN/operations/troubleshooting" },
    ],
  },
  {
    text: "扩展",
    items: [
      { text: "插件架构", link: "/zh-CN/plugins/architecture" },
      { text: "插件 SDK", link: "/zh-CN/plugins/sdk" },
      { text: "编写适配器", link: "/zh-CN/plugins/adapters" },
    ],
  },
  {
    text: "参考",
    items: [
      { text: "统计口径", link: "/zh-CN/reference/analytics" },
      { text: "环境绑定", link: "/zh-CN/reference/environment" },
      { text: "命令索引", link: "/zh-CN/reference/commands" },
    ],
  },
]

export default defineConfig({
  title: "i0c.cc Docs",
  description: "A personal edge redirect playground with a database-backed control plane.",
  vite: {
    build: {
      // The workspace esbuild pin rejects Vite 5's equivalent multi-target transform list.
      target: "es2020",
    },
    optimizeDeps: {
      esbuildOptions: {
        target: "es2020",
      },
    },
  },
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ["README.md", "README.zh-CN.md"],
  sitemap: {
    hostname: "https://d.i0c.cc",
  },
  head: [
    ["link", { rel: "icon", href: "/favicon.ico", type: "image/x-icon" }],
    ["meta", { name: "theme-color", content: "#3157d5" }],
  ],
  locales: {
    root: {
      label: "English",
      lang: "en-US",
      themeConfig: {
        siteTitle: "i0c.cc Docs",
        nav: englishNav,
        sidebar: englishSidebar,
        outlineTitle: "On this page",
        lastUpdatedText: "Last updated",
        docFooter: {
          prev: "Previous page",
          next: "Next page",
        },
        editLink: {
          pattern: `${repositoryUrl}/edit/main/apps/docs/:path`,
          text: "Edit this page on GitHub",
        },
        footer: {
          message: `<span class="i0c-footer-links">${footerMessage}</span>`,
          copyright: "© 2025 – present Cedarflake",
        },
        notFound: {
          code: "404",
          title: "PAGE NOT FOUND",
          quote: "But if you don't change your direction, and if you keep looking, you may end up where you are heading.",
          linkLabel: "Go to home",
          linkText: "Take me home",
        },
      },
    },
    "zh-CN": {
      label: "简体中文",
      lang: "zh-CN",
      link: "/zh-CN/",
      title: "i0c.cc 文档",
      themeConfig: {
        siteTitle: "i0c.cc 文档",
        nav: chineseNav,
        sidebar: chineseSidebar,
        outlineTitle: "本页内容",
        lastUpdatedText: "最后更新",
        docFooter: {
          prev: "上一页",
          next: "下一页",
        },
        editLink: {
          pattern: `${repositoryUrl}/edit/main/apps/docs/:path`,
          text: "在 GitHub 上编辑此页",
        },
        footer: {
          message: `<span class="i0c-footer-links">${footerMessage}</span>`,
          copyright: "© 2025 – present Cedarflake",
        },
        notFound: {
          code: "404",
          title: "页面未找到",
          quote: "如果你不改变方向，并继续寻找下去，最终可能会到达你正前往的地方。",
          linkLabel: "前往首页",
          linkText: "带我回首页",
        },
        langMenuLabel: "切换语言",
        returnToTopLabel: "返回顶部",
        sidebarMenuLabel: "文档导航",
        darkModeSwitchLabel: "外观",
        lightModeSwitchTitle: "切换到浅色模式",
        darkModeSwitchTitle: "切换到深色模式",
      },
    },
  },
  themeConfig: {
    logo: {
      src: "/logo.ico",
      alt: "i0c.cc",
    },
    search: {
      provider: "local",
      options: {
        locales: {
          "zh-CN": {
            translations: {
              button: {
                buttonText: "搜索文档",
                buttonAriaLabel: "搜索文档",
              },
              modal: {
                noResultsText: "没有找到相关结果",
                resetButtonTitle: "清除搜索条件",
                footer: {
                  selectText: "选择",
                  navigateText: "切换",
                  closeText: "关闭",
                },
              },
            },
          },
        },
      },
    },
    socialLinks: [
      { icon: "github", link: repositoryUrl },
    ],
  },
})
