import fs from "node:fs/promises";
import { execSync } from "child_process";
import path from "node:path";
import { CONFIG_FILE, HOME_DIR } from "../constants";
import JSON5 from "json5";

export interface StatusLineModuleConfig {
  type: string;
  icon?: string;
  text: string;
  color?: string;
  background?: string;
  scriptPath?: string;
}

export interface StatusLineThemeConfig {
  modules: StatusLineModuleConfig[];
}

export interface StatusLineInput {
  hook_event_name: string;
  session_id: string;
  transcript_path: string;
  cwd: string;
  model: {
    id: string;
    display_name: string;
  };
  workspace: {
    current_dir: string;
    project_dir: string;
  };
}

export interface AssistantMessage {
  type: "assistant";
  message: {
    model: string;
    usage: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

const COLORS: Record<string, string> = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bright_black: "\x1b[90m",
  bright_red: "\x1b[91m",
  bright_green: "\x1b[92m",
  bright_yellow: "\x1b[93m",
  bright_blue: "\x1b[94m",
  bright_magenta: "\x1b[95m",
  bright_cyan: "\x1b[96m",
  bright_white: "\x1b[97m",
  bg_black: "\x1b[40m",
  bg_red: "\x1b[41m",
  bg_green: "\x1b[42m",
  bg_yellow: "\x1b[43m",
  bg_blue: "\x1b[44m",
  bg_magenta: "\x1b[45m",
  bg_cyan: "\x1b[46m",
  bg_white: "\x1b[47m",
  bg_bright_black: "\x1b[100m",
  bg_bright_red: "\x1b[101m",
  bg_bright_green: "\x1b[102m",
  bg_bright_yellow: "\x1b[103m",
  bg_bright_blue: "\x1b[104m",
  bg_bright_magenta: "\x1b[105m",
  bg_bright_cyan: "\x1b[106m",
  bg_bright_white: "\x1b[107m",
};

const TRUE_COLOR_PREFIX = "\x1b[38;2;";
const TRUE_COLOR_BG_PREFIX = "\x1b[48;2;";

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {

  hex = hex.replace(/^#/, '').trim();
  
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  
  if (hex.length !== 6) {
    return null;
  }
  
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  if (isNaN(r) || isNaN(g) || isNaN(b) || r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
    return null;
  }
  
  return { r, g, b };
}

function getColorCode(colorName: string): string {
  if (colorName.startsWith('#') || /^[0-9a-fA-F]{6}$/.test(colorName) || /^[0-9a-fA-F]{3}$/.test(colorName)) {
    const rgb = hexToRgb(colorName);
    if (rgb) {
      return `${TRUE_COLOR_PREFIX}${rgb.r};${rgb.g};${rgb.b}m`;
    }
  }
  
  return "";
}


function replaceVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_match, varName) => {
    return variables[varName] || "";
  });
}

async function executeScript(scriptPath: string, variables: Record<string, string>): Promise<string> {
  try {
    await fs.access(scriptPath);
    
    const scriptModule = require(scriptPath);
    
    if (typeof scriptModule === 'function') {
      const result = scriptModule(variables);
      if (result instanceof Promise) {
        return await result;
      }
      return result;
    }
    
    if (scriptModule.default && typeof scriptModule.default === 'function') {
      const result = scriptModule.default(variables);
      if (result instanceof Promise) {
        return await result;
      }
      return result;
    }
    
    if (typeof scriptModule === 'string') {
      return scriptModule;
    }
    
    if (scriptModule.default && typeof scriptModule.default === 'string') {
      return scriptModule.default;
    }
    
    return "";
  } catch (error) {
    console.error(`执行脚本 ${scriptPath} 时出错:`, error);
    return "";
  }
}

const DEFAULT_THEME: StatusLineThemeConfig = {
  modules: [
    {
      type: "workDir",
      icon: "󰉋", // nf-md-folder_outline
      text: "{{workDirName}}",
      color: "bright_blue"
    },
    {
      type: "gitBranch",
      icon: "", // nf-dev-git_branch
      text: "{{gitBranch}}",
      color: "bright_magenta"
    },
    {
      type: "model",
      icon: "󰚩", // nf-md-robot_outline
      text: "{{model}}",
      color: "bright_cyan"
    },
    {
      type: "usage",
      icon: "↑", // 上箭头
      text: "{{inputTokens}}",
      color: "bright_green"
    },
    {
      type: "usage",
      icon: "↓", // 下箭头
      text: "{{outputTokens}}",
      color: "bright_yellow"
    }
  ]
};

const POWERLINE_THEME: StatusLineThemeConfig = {
  modules: [
    {
      type: "workDir",
      icon: "󰉋", // nf-md-folder_outline
      text: "{{workDirName}}",
      color: "white",
      background: "bg_bright_blue"
    },
    {
      type: "gitBranch",
      icon: "", // nf-dev-git_branch
      text: "{{gitBranch}}",
      color: "white",
      background: "bg_bright_magenta"
    },
    {
      type: "model",
      icon: "󰚩", // nf-md-robot_outline
      text: "{{model}}",
      color: "white",
      background: "bg_bright_cyan"
    },
    {
      type: "usage",
      icon: "↑", // 上箭头
      text: "{{inputTokens}}",
      color: "white",
      background: "bg_bright_green"
    },
    {
      type: "usage",
      icon: "↓", // 下箭头
      text: "{{outputTokens}}",
      color: "white",
      background: "bg_bright_yellow"
    }
  ]
};

const SIMPLE_THEME: StatusLineThemeConfig = {
  modules: [
    {
      type: "workDir",
      icon: "",
      text: "{{workDirName}}",
      color: "bright_blue"
    },
    {
      type: "gitBranch",
      icon: "",
      text: "{{gitBranch}}",
      color: "bright_magenta"
    },
    {
      type: "model",
      icon: "",
      text: "{{model}}",
      color: "bright_cyan"
    },
    {
      type: "usage",
      icon: "↑",
      text: "{{inputTokens}}",
      color: "bright_green"
    },
    {
      type: "usage",
      icon: "↓",
      text: "{{outputTokens}}",
      color: "bright_yellow"
    }
  ]
};

function formatUsage(input_tokens: number, output_tokens: number): string {
  if (input_tokens > 1000 || output_tokens > 1000) {
    const inputFormatted = input_tokens > 1000 ? `${(input_tokens / 1000).toFixed(1)}k` : `${input_tokens}`;
    const outputFormatted = output_tokens > 1000 ? `${(output_tokens / 1000).toFixed(1)}k` : `${output_tokens}`;
    return `${inputFormatted} ${outputFormatted}`;
  }
  return `${input_tokens} ${output_tokens}`;
}

async function getProjectThemeConfig(): Promise<{ theme: StatusLineThemeConfig | null, style: string }> {
  try {
    const configPath = CONFIG_FILE;
    
    try {
      await fs.access(configPath);
    } catch {
      return { theme: null, style: 'default' };
    }
    
    const configContent = await fs.readFile(configPath, "utf-8");
    const config = JSON5.parse(configContent);
    
    if (config.StatusLine) {
      const currentStyle = config.StatusLine.currentStyle || 'default';
      
      if (config.StatusLine[currentStyle] && config.StatusLine[currentStyle].modules) {
        return { theme: config.StatusLine[currentStyle], style: currentStyle };
      }
    }
  } catch (error) {
    // console.error("Failed to read theme config:", error);
  }
  
  return { theme: null, style: 'default' };
}

function shouldUseSimpleTheme(): boolean {
  if (process.env.USE_SIMPLE_ICONS === 'true') {
    return true;
  }
  
  const term = process.env.TERM || '';
  const unsupportedTerms = ['dumb', 'unknown'];
  if (unsupportedTerms.includes(term)) {
    return true;
  }
  
  return false;
}

function canDisplayNerdFonts(): boolean {
  if (process.env.USE_SIMPLE_ICONS === 'true') {
    return false;
  }
  
  const fontEnvVars = ['NERD_FONT', 'NERDFONT', 'FONT'];
  for (const envVar of fontEnvVars) {
    const value = process.env[envVar];
    if (value && (value.includes('Nerd') || value.includes('nerd'))) {
      return true;
    }
  }
  
  const termProgram = process.env.TERM_PROGRAM || '';
  const supportedTerminals = ['iTerm.app', 'vscode', 'Hyper', 'kitty', 'alacritty'];
  if (supportedTerminals.includes(termProgram)) {
    return true;
  }
  
  const colorTerm = process.env.COLORTERM || '';
  if (colorTerm.includes('truecolor') || colorTerm.includes('24bit')) {
    return true;
  }
  
  return process.env.USE_SIMPLE_ICONS !== 'true';
}

function canDisplayUnicodeCharacter(char: string): boolean {
  try {
    const lang = process.env.LANG || process.env.LC_ALL || process.env.LC_CTYPE || '';
    if (lang.includes('UTF-8') || lang.includes('utf8') || lang.includes('UTF8')) {
      return true;
    }
    
    const lcVars = ['LC_ALL', 'LC_CTYPE', 'LANG'];
    for (const lcVar of lcVars) {
      const value = process.env[lcVar];
      if (value && (value.includes('UTF-8') || value.includes('utf8'))) {
        return true;
      }
    }
  } catch (e) {
    return true;
  }
  
  return true;
}

export async function parseStatusLineData(input: StatusLineInput): Promise<string> {
  try {
    const useSimpleTheme = shouldUseSimpleTheme();
    
    const canDisplayNerd = canDisplayNerdFonts();
    
    const effectiveTheme = useSimpleTheme || !canDisplayNerd ? SIMPLE_THEME : DEFAULT_THEME;
    
    const { theme: projectTheme, style: currentStyle } = await getProjectThemeConfig();
    const theme = projectTheme || effectiveTheme;
    
    const workDir = input.workspace.current_dir;
    let gitBranch = "";
    
    try {
      gitBranch = execSync("git branch --show-current", {
        cwd: workDir,
        stdio: ["pipe", "pipe", "ignore"],
      })
        .toString()
        .trim();
    } catch (error) {
      // 如果不是Git仓库或获取失败，则忽略错误
    }
    
    // 从transcript_path文件中读取最后一条assistant消息
    const transcriptContent = await fs.readFile(input.transcript_path, "utf-8");
    const lines = transcriptContent.trim().split("\n");
    
    // 反向遍历寻找最后一条assistant消息
    let model = "";
    let inputTokens = 0;
    let outputTokens = 0;
    
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const message: AssistantMessage = JSON.parse(lines[i]);
        if (message.type === "assistant" && message.message.model) {
          model = message.message.model;
          
          if (message.message.usage) {
            inputTokens = message.message.usage.input_tokens;
            outputTokens = message.message.usage.output_tokens;
          }
          break;
        }
      } catch (parseError) {
        // 忽略解析错误，继续查找
        continue;
      }
    }
    
    // 如果没有从transcript中获取到模型名称，则尝试从配置文件中获取
    if (!model) {
      try {
        // 获取项目配置文件路径
        const projectConfigPath = path.join(workDir, ".claude-code-router", "config.json");
        let configPath = projectConfigPath;
        
        // 检查项目配置文件是否存在，如果不存在则使用用户主目录的配置文件
        try {
          await fs.access(projectConfigPath);
        } catch {
          configPath = CONFIG_FILE;
        }
        
        // 读取配置文件
        const configContent = await fs.readFile(configPath, "utf-8");
        const config = JSON5.parse(configContent);
        
        // 从Router字段的default内容中获取模型名称
        if (config.Router && config.Router.default) {
          const [, defaultModel] = config.Router.default.split(",");
          if (defaultModel) {
            model = defaultModel.trim();
          }
        }
      } catch (configError) {
        // 如果配置文件读取失败，则忽略错误
      }
    }
    
    // 如果仍然没有获取到模型名称，则使用传入的JSON数据中的model字段的display_name
    if (!model) {
      model = input.model.display_name;
    }
    
    // 获取工作目录名
    const workDirName = workDir.split("/").pop() || "";
    
    // 格式化usage信息
    const usage = formatUsage(inputTokens, outputTokens);
    const [formattedInputTokens, formattedOutputTokens] = usage.split(" ");
    
    // 定义变量替换映射
    const variables = {
      workDirName,
      gitBranch,
      model,
      inputTokens: formattedInputTokens,
      outputTokens: formattedOutputTokens
    };
    
    // 确定使用的风格
    const isPowerline = currentStyle === 'powerline';
    
    // 根据风格渲染状态行
    if (isPowerline) {
      return await renderPowerlineStyle(theme, variables);
    } else {
      return await renderDefaultStyle(theme, variables);
    }
  } catch (error) {
    // 发生错误时返回空字符串
    return "";
  }
}

// 读取用户主目录的主题配置（指定风格）
async function getProjectThemeConfigForStyle(style: string): Promise<StatusLineThemeConfig | null> {
  try {
    // 只使用主目录的固定配置文件
    const configPath = CONFIG_FILE;
    
    // 检查配置文件是否存在
    try {
      await fs.access(configPath);
    } catch {
      return null;
    }
    
    const configContent = await fs.readFile(configPath, "utf-8");
    const config = JSON5.parse(configContent);
    
    // 检查是否有StatusLine配置
    if (config.StatusLine && config.StatusLine[style] && config.StatusLine[style].modules) {
      return config.StatusLine[style];
    }
  } catch (error) {
    // 如果读取失败，返回null
    // console.error("Failed to read theme config:", error);
  }
  
  return null;
}

// 渲染默认风格的状态行
async function renderDefaultStyle(
  theme: StatusLineThemeConfig,
  variables: Record<string, string>
): Promise<string> {
  const modules = theme.modules || DEFAULT_THEME.modules;
  const parts: string[] = [];
  
  // 遍历模块数组，渲染每个模块
  for (let i = 0; i < Math.min(modules.length, 5); i++) {
    const module = modules[i];
    const color = module.color ? getColorCode(module.color) : "";
    const background = module.background ? getColorCode(module.background) : "";
    const icon = module.icon || "";
    
    // 如果是script类型，执行脚本获取文本
    let text = "";
    if (module.type === "script" && module.scriptPath) {
      text = await executeScript(module.scriptPath, variables);
    } else {
      text = replaceVariables(module.text, variables);
    }
    
    // 构建显示文本
    let displayText = "";
    if (icon) {
      displayText += `${icon} `;
    }
    displayText += text;
    
    // 如果displayText为空，或者只有图标没有实际文本，则跳过该模块
    if (!displayText || !text) {
      continue;
    }
    
    // 构建模块字符串
    let part = `${background}${color}`;
    part += `${displayText}${COLORS.reset}`;
    
    parts.push(part);
  }
  
  // 使用空格连接所有部分
  return parts.join(" ");
}

// Powerline符号
const SEP_RIGHT = "\uE0B0"; // 

// 颜色编号（256色表）
const COLOR_MAP: Record<string, number> = {
  // 基础颜色映射到256色
  black: 0,
  red: 1,
  green: 2,
  yellow: 3,
  blue: 4,
  magenta: 5,
  cyan: 6,
  white: 7,
  bright_black: 8,
  bright_red: 9,
  bright_green: 10,
  bright_yellow: 11,
  bright_blue: 12,
  bright_magenta: 13,
  bright_cyan: 14,
  bright_white: 15,
  // 亮背景色映射
  bg_black: 0,
  bg_red: 1,
  bg_green: 2,
  bg_yellow: 3,
  bg_blue: 4,
  bg_magenta: 5,
  bg_cyan: 6,
  bg_white: 7,
  bg_bright_black: 8,
  bg_bright_red: 9,
  bg_bright_green: 10,
  bg_bright_yellow: 11,
  bg_bright_blue: 12,
  bg_bright_magenta: 13,
  bg_bright_cyan: 14,
  bg_bright_white: 15,
  // 自定义颜色映射
  bg_bright_orange: 202,
  bg_bright_purple: 129,
};

// 获取TrueColor的RGB值
function getTrueColorRgb(colorName: string): { r: number; g: number; b: number } | null {
  // 如果是预定义颜色，返回对应RGB
  if (COLOR_MAP[colorName] !== undefined) {
    const color256 = COLOR_MAP[colorName];
    return color256ToRgb(color256);
  }
  
  // 处理十六进制颜色
  if (colorName.startsWith('#') || /^[0-9a-fA-F]{6}$/.test(colorName) || /^[0-9a-fA-F]{3}$/.test(colorName)) {
    return hexToRgb(colorName);
  }
  
  // 处理背景色十六进制
  if (colorName.startsWith('bg_#')) {
    return hexToRgb(colorName.substring(3));
  }
  
  return null;
}

// 将256色表索引转换为RGB值
function color256ToRgb(index: number): { r: number; g: number; b: number } | null {
  if (index < 0 || index > 255) return null;
  
  // ANSI 256色表转换
  if (index < 16) {
    // 基本颜色
    const basicColors = [
      [0, 0, 0], [128, 0, 0], [0, 128, 0], [128, 128, 0],
      [0, 0, 128], [128, 0, 128], [0, 128, 128], [192, 192, 192],
      [128, 128, 128], [255, 0, 0], [0, 255, 0], [255, 255, 0],
      [0, 0, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255]
    ];
    return { r: basicColors[index][0], g: basicColors[index][1], b: basicColors[index][2] };
  } else if (index < 232) {
    // 216色：6×6×6的颜色立方体
    const i = index - 16;
    const r = Math.floor(i / 36);
    const g = Math.floor((i % 36) / 6);
    const b = i % 6;
    const rgb = [0, 95, 135, 175, 215, 255];
    return { r: rgb[r], g: rgb[g], b: rgb[b] };
  } else {
    // 灰度色
    const gray = 8 + (index - 232) * 10;
    return { r: gray, g: gray, b: gray };
  }
}

// 生成一个无缝拼接的段：文本在 bgN 上显示，分隔符从 bgN 过渡到 nextBgN
function segment(text: string, textFg: string, bgColor: string, nextBgColor: string | null): string {
  const bgRgb = getTrueColorRgb(bgColor);
  if (!bgRgb) {
    // 如果无法获取RGB，使用默认蓝色背景
    const defaultBlueRgb = { r: 33, g: 150, b: 243 };
    const curBg = `\x1b[48;2;${defaultBlueRgb.r};${defaultBlueRgb.g};${defaultBlueRgb.b}m`;
    const fgColor = `\x1b[38;2;255;255;255m`;
    const body = `${curBg}${fgColor} ${text} \x1b[0m`;
    return body;
  }
  
  const curBg = `\x1b[48;2;${bgRgb.r};${bgRgb.g};${bgRgb.b}m`;
  
  // 获取前景色RGB
  let fgRgb = { r: 255, g: 255, b: 255 }; // 默认前景色为白色
  const textFgRgb = getTrueColorRgb(textFg);
  if (textFgRgb) {
    fgRgb = textFgRgb;
  }
  
  const fgColor = `\x1b[38;2;${fgRgb.r};${fgRgb.g};${fgRgb.b}m`;
  const body = `${curBg}${fgColor} ${text} \x1b[0m`;
  
  if (nextBgColor != null) {
    const nextBgRgb = getTrueColorRgb(nextBgColor);
    if (nextBgRgb) {
      // 分隔符：前景色是当前段的背景色，背景色是下一段的背景色
      const sepCurFg = `\x1b[38;2;${bgRgb.r};${bgRgb.g};${bgRgb.b}m`;
      const sepNextBg = `\x1b[48;2;${nextBgRgb.r};${nextBgRgb.g};${nextBgRgb.b}m`;
      const sep = `${sepCurFg}${sepNextBg}${SEP_RIGHT}\x1b[0m`;
      return body + sep;
    }
    // 如果没有下一个背景色，假设终端背景为黑色并渲染黑色箭头
    const sepCurFg = `\x1b[38;2;${bgRgb.r};${bgRgb.g};${bgRgb.b}m`;
    const sepNextBg = `\x1b[48;2;0;0;0m`; // 黑色背景
    const sep = `${sepCurFg}${sepNextBg}${SEP_RIGHT}\x1b[0m`;
    return body + sep;
  }
  
  return body;
}

// 渲染Powerline风格的状态行
async function renderPowerlineStyle(
  theme: StatusLineThemeConfig,
  variables: Record<string, string>
): Promise<string> {
  const modules = theme.modules || POWERLINE_THEME.modules;
  const segments: string[] = [];
  
  // 遍历模块数组，渲染每个模块
  for (let i = 0; i < Math.min(modules.length, 5); i++) {
    const module = modules[i];
    const color = module.color || "white";
    const backgroundName = module.background || "";
    const icon = module.icon || "";
    
    // 如果是script类型，执行脚本获取文本
    let text = "";
    if (module.type === "script" && module.scriptPath) {
      text = await executeScript(module.scriptPath, variables);
    } else {
      text = replaceVariables(module.text, variables);
    }
    
    // 构建显示文本
    let displayText = "";
    if (icon) {
      displayText += `${icon} `;
    }
    displayText += text;
    
    // 如果displayText为空，或者只有图标没有实际文本，则跳过该模块
    if (!displayText || !text) {
      continue;
    }
    
    // 获取下一个模块的背景色（用于分隔符）
    let nextBackground: string | null = null;
    if (i < modules.length - 1) {
      const nextModule = modules[i + 1];
      nextBackground = nextModule.background || null;
    }
    
    // 使用模块定义的背景色，或者为Powerline风格提供默认背景色
    const actualBackground = backgroundName || "bg_bright_blue";
    
    // 生成段，支持十六进制颜色
    const segmentStr = segment(displayText, color, actualBackground, nextBackground);
    segments.push(segmentStr);
  }
  
  return segments.join("");
}
