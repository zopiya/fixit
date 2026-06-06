import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'FixIt',
    description: '点选网页问题元素，一键生成 AI 修改工单',
    permissions: ['storage', 'activeTab', 'scripting', 'sidePanel'],
    minimum_chrome_version: '114',
    side_panel: {
      default_path: 'entrypoints/sidepanel/index.html',
    },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+F' },
        description: '激活/关闭 FixIt 标注模式',
      },
    },
    icons: {
      '16': 'icons/16.png',
      '32': 'icons/32.png',
      '48': 'icons/48.png',
      '128': 'icons/128.png',
    },
    action: {
      default_icon: {
        '16': 'icons/16.png',
        '32': 'icons/32.png',
      },
      default_title: 'FixIt',
    },
  },
});
