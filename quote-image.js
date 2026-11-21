'use strict';

function wrapImageText(context, text, width) {
  const lines = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      if (!word) continue;
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width <= width) { line = candidate; continue; }
      if (line) lines.push(line);
      line = '';
      for (const character of word) {
        if (line && context.measureText(line + character).width > width) { lines.push(line); line = ''; }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

async function downloadQuoteImage(clip) {
  const image = document.createElement('canvas');
  const context = image.getContext('2d');
  const width = 1080;
  const normalHeight = 1350;
  const serif = '"Libre Caslon Display", Georgia, serif';
  const sans = '"DM Sans", Arial, sans-serif';
  const style = getComputedStyle(document.documentElement);
  const ink = style.getPropertyValue('--ink').trim();
  const accent = style.getPropertyValue('--accent').trim();
  const paper = style.getPropertyValue(`--${clip.color}`).trim();
  const fontFor = size => `${size}px ${serif}`;
  await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 360))]);

  let fontSize = 84;
  let quoteLines;
  while (fontSize >= 42) {
    context.font = fontFor(fontSize);
    quoteLines = wrapImageText(context, clip.quote, 700);
    if (quoteLines.length * fontSize * 1.13 <= 710 || fontSize === 42) break;
    fontSize -= 6;
  }
  const leading = fontSize * 1.13;
  const quoteHeight = quoteLines.length * leading;
  context.font = `600 24px ${sans}`;
  const titleLines = wrapImageText(context, clip.title, 700);
  const domain = new URL(clip.url).hostname.replace(/^www\./, '');
  context.font = `20px ${sans}`;
  const creditLines = wrapImageText(context, [clip.author, domain].filter(Boolean).join('  ·  '), 700);
  const creditsHeight = titleLines.length * 30 + creditLines.length * 25;
  const height = Math.ceil(Math.max(normalHeight, 520 + quoteHeight + creditsHeight));
  if (height > 16384) throw new Error('Quote image exceeds the canvas size');
  image.width = width;
  image.height = height;

  context.fillStyle = '#efedf5';
  context.fillRect(0, 0, width, height);
  const glow = context.createRadialGradient(173, 127, 0, 173, 127, 1060);
  glow.addColorStop(0, '#fff9ea');
  glow.addColorStop(1, '#fff9ea00');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#51446338';
  for (let x = 20; x < width; x += 25) {
    for (let y = 20; y < height; y += 25) context.fillRect(x, y, 2, 2);
  }

  context.fillStyle = ink;
  context.fillRect(106, 87, 56, 54);
  context.fillStyle = accent;
  context.fillRect(102, 83, 56, 54);
  context.fillStyle = ink;
  context.textBaseline = 'alphabetic';
  context.font = 'italic 37px Georgia, serif';
  context.fillText('w.', 110, 119);
  context.font = `700 24px ${sans}`;
  context.fillText('Wall of Substack', 180, 118);

  const sheet = {x: 103, y: 204, right: 977, bottom: height - 123};
  context.beginPath();
  context.moveTo(sheet.x, sheet.y);
  context.lineTo(sheet.right, sheet.y);
  for (let x = sheet.right; x > sheet.x; x -= 13) {
    context.lineTo(x, sheet.bottom + (x % 7) * 1.6);
  }
  context.lineTo(sheet.x, sheet.bottom);
  context.closePath();
  context.save();
  context.fillStyle = paper;
  context.shadowColor = '#40304b34';
  context.shadowBlur = 34;
  context.shadowOffsetY = 16;
  context.fill();
  context.restore();
  context.strokeStyle = '#6d5a6d34';
  context.stroke();

  context.save();
  context.translate(163, 176);
  context.rotate(.2);
  context.lineWidth = 4;
  context.strokeStyle = '#655583';
  context.beginPath();
  context.roundRect(0, 0, 29, 90, 14);
  context.roundRect(7, 12, 14, 65, 7);
  context.stroke();
  context.restore();

  const quoteTop = Math.max(300, sheet.y + (sheet.bottom - sheet.y - quoteHeight - creditsHeight - 90) / 2);
  const left = 190;
  context.font = fontFor(fontSize);
  context.textBaseline = 'top';
  if (quoteLines.length <= 3) {
    const last = quoteLines.at(-1);
    if (last) {
      context.fillStyle = accent;
      context.fillRect(left - 5, quoteTop + (quoteLines.length - 1) * leading + fontSize * .66, context.measureText(last).width + 10, fontSize * .26);
    }
  }
  context.fillStyle = ink;
  quoteLines.forEach((line, index) => context.fillText(line, left, quoteTop + index * leading));

  const creditTop = quoteTop + quoteHeight + 52;
  context.fillStyle = '#74618055';
  context.fillRect(left, creditTop - 22, 700, 2);
  context.fillStyle = ink;
  context.font = `600 24px ${sans}`;
  titleLines.forEach((line, index) => context.fillText(line, left, creditTop + index * 30));
  context.fillStyle = '#60586f';
  context.font = `20px ${sans}`;
  creditLines.forEach((line, index) => context.fillText(line, left, creditTop + titleLines.length * 30 + 6 + index * 25));

  const blob = await new Promise(resolve => image.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not render the quote image');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const slug = (clip.author || titleLines[0]).toLowerCase().replace(/[^a-z\d]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  link.download = `${slug || 'clipping'}-wall-of-substack.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
