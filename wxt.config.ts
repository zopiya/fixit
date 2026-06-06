import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'FixIt',
    description: '点选网页问题元素，一键生成 AI 修改工单',
    permissions: ['storage', 'activeTab', 'sidePanel', 'contextMenus'],
    minimum_chrome_version: '114',
    side_panel: {
      default_path: 'entrypoints/sidepanel/index.html',
    },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+F' },
        description: 'Toggle FixIt annotation mode',
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
