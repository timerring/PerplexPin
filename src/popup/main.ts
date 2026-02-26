// @ts-ignore — imported as raw string by Vite
import scriptSource from '../perplexpin.js?raw';

const modelListEl = document.getElementById('model-list')!;
const statusText = document.getElementById('status-text')!;

function getScript(): string {
  return scriptSource
    .replace(/\/\/.*$/gm, '')
    .replace(/\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

function flashButton(btn: HTMLButtonElement, icon: string, label: string, color: string, originalIcon: string, originalLabel: string, originalColor: string) {
  btn.innerHTML = `<span style="font-size:16px;">${icon}</span> ${label}`;
  btn.style.background = color;
  setTimeout(() => {
    btn.innerHTML = `<span style="font-size:16px;">${originalIcon}</span> ${originalLabel}`;
    btn.style.background = originalColor;
    statusText.textContent = 'Ready';
  }, 2500);
}

function makeButton(icon: string, label: string, color: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.style.cssText = `display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px;background:${color};color:#fff;font-weight:600;font-size:14px;border:none;border-radius:10px;cursor:pointer;transition:all 0.2s;`;
  btn.innerHTML = `<span style="font-size:16px;">${icon}</span> ${label}`;
  const hoverColor = color.replace(/([0-9a-f]{2})/gi, (_, h) => {
    const v = Math.min(255, parseInt(h, 16) + 16);
    return v.toString(16).padStart(2, '0');
  });
  btn.onmouseenter = () => { btn.style.background = hoverColor; };
  btn.onmouseleave = () => { btn.style.background = color; };
  return btn;
}

function init() {
  const script = getScript();
  statusText.textContent = 'Ready';
  modelListEl.innerHTML = '';

  // ── Copy Script button ──
  const copyBtn = makeButton('', 'Copy Script', '#4a4aff');
  copyBtn.addEventListener('click', async () => {
    await copyToClipboard(script);
    flashButton(copyBtn, '\u2705', 'Copied!', '#22c55e', '', 'Copy Script', '#4a4aff');
    statusText.textContent = 'Now paste in console (F12)';
  });
  modelListEl.appendChild(copyBtn);

  // ── Instructions ──
  const steps = document.createElement('div');
  steps.style.cssText = 'font-size:13px;line-height:1.7;color:#bbb;margin-top:14px;';
  steps.innerHTML = [
    '<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:12px;margin-bottom:8px;">',
    '  <p style="margin:0 0 8px;font-weight:600;color:#ddd;">How to use:</p>',
    '  <ol style="margin:0;padding-left:20px;">',
    '    <li>Open <b>Perplexity</b>, press <b>F12</b> → Console</li>',
    '    <li>Click <b>Copy Script</b> above</li>',
    '    <li>Paste in console & run — pick your model</li>',
    '    <li>Guard persists across page loads</li>',
    '  </ol>',
    '</div>',
    '<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:12px;">',
    '  <p style="margin:0 0 8px;font-weight:600;color:#ddd;">Switch model anytime:</p>',
    '  <p style="margin:0;color:#999;">Paste again — picker always appears</p>',
    '</div>',
  ].join('\n');
  modelListEl.appendChild(steps);
}

init();
