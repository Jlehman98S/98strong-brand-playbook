/* 98Strong Personal Brand Playbook: PDF export.
   window.buildPlaybookPDF({me, answers, photos, logo}) -> Promise<jsPDF doc>
   photos: { [photoId]: dataURL } for mood board pictures. */
(function () {
  const W = 792, H = 612, M = 48;            // US Letter landscape, points
  const C = { black: [11, 11, 11], panel: [24, 24, 24], cream: [247, 236, 220], gold: [217, 163, 48],
              white: [244, 239, 231], muted: [150, 143, 135], ink: [20, 20, 20], line: [52, 52, 52] };
  let fontsLoaded = null;

  async function b64(url) {
    const buf = await (await fetch(url)).arrayBuffer();
    let s = '', bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  async function loadFonts(doc) {
    fontsLoaded = fontsLoaded || Promise.all([
      b64('fonts/BarlowCondensed-ExtraBoldItalic.ttf'), b64('fonts/Inter-Regular.ttf'), b64('fonts/Inter-Bold.ttf')]);
    const [barlow, inter, interB] = await fontsLoaded;
    doc.addFileToVFS('Barlow.ttf', barlow); doc.addFont('Barlow.ttf', 'Barlow', 'normal');
    doc.addFileToVFS('Inter.ttf', inter); doc.addFont('Inter.ttf', 'Inter', 'normal');
    doc.addFileToVFS('InterB.ttf', interB); doc.addFont('InterB.ttf', 'Inter', 'bold');
  }
  // crop a data URL to a box aspect (cover) and return {url}
  function cover(url, w, h) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => {
        const k = 2, cw = Math.round(w * k), ch = Math.round(h * k);
        const c = document.createElement('canvas'); c.width = cw; c.height = ch;
        const s = Math.max(cw / img.width, ch / img.height);
        const dw = img.width * s, dh = img.height * s;
        const g = c.getContext('2d'); g.fillStyle = '#191919'; g.fillRect(0, 0, cw, ch);
        g.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
        res(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => res(null);
      img.src = url;
    });
  }

  window.buildPlaybookPDF = async function ({ me, answers, photos, logo }) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
    await loadFonts(doc);
    const A = (s, k) => ((answers || {})[s] || {})[k];
    const txt = v => String(v || '').trim();
    const board = (A('discover', 'board') || []).filter(x => x && (x.what || x.photo));
    let page = 0;

    const fill = c => doc.setFillColor(...c), color = c => doc.setTextColor(...c);
    function newPage(bg, label) {
      if (page++) doc.addPage();
      fill(bg); doc.rect(0, 0, W, H, 'F');
      if (label) {
        const light = bg === C.cream;
        if (logo && !light) doc.addImage(logo, 'PNG', M, 22, 30, 24);
        doc.setFont('Inter', 'bold'); doc.setFontSize(7.5); color(light ? C.ink : C.white);
        doc.text(light ? '98STRONG  ·  PERSONAL BRAND PLAYBOOK' : 'PERSONAL BRAND PLAYBOOK', light ? M : M + 40, 38);
        color(C.gold); doc.text(label.toUpperCase(), W - M, 38, { align: 'right' });
        doc.setDrawColor(...C.gold); doc.setLineWidth(0.6); doc.line(M, 54, W - M, 54);
      }
      doc.setFont('Inter', 'normal'); doc.setFontSize(7.5); color(C.muted);
      doc.text(`${txt(me.name)} · 98STRONG STUDENT ATHLETE DEVELOPMENT`, M, H - 22);
      doc.text(String(page).padStart(2, '0'), W - M, H - 22, { align: 'right' });
    }
    function title(t, y, size = 40, c = C.white) {
      doc.setFont('Barlow', 'normal'); doc.setFontSize(size); color(c);
      doc.text(t.toUpperCase(), M, y); return y + size * 0.35;
    }
    function rule(y, w = 260) { fill(C.gold); doc.rect(M, y, w, 2, 'F'); }
    // labelled text box; returns bottom y
    function box(x, y, w, h, label, body, opt = {}) {
      const bg = opt.bg || C.panel, fg = opt.fg || C.white;
      fill(bg); doc.rect(x, y, w, h, 'F'); fill(C.gold); doc.rect(x, y, w, 3, 'F');
      doc.setFont('Barlow', 'normal'); doc.setFontSize(opt.labelSize || 15); color(opt.labelColor || (bg === C.gold ? C.ink : C.gold));
      doc.text(label.toUpperCase(), x + 14, y + 26);
      doc.setFont('Inter', 'normal'); const fs = opt.size || 10; doc.setFontSize(fs); color(fg);
      const lines = doc.splitTextToSize(txt(body) || '—', w - 28);
      const max = Math.max(1, Math.floor((h - 42) / (fs * 1.45)));
      const shown = lines.slice(0, max); if (lines.length > max) shown[max - 1] = shown[max - 1].replace(/\s*\S*$/, '…');
      doc.text(shown, x + 14, y + 44, { lineHeightFactor: 1.45 });
      return y + h;
    }
    const has = (...v) => v.some(x => txt(x));

    /* 1. Cover */
    newPage(C.black);
    if (logo) doc.addImage(logo, 'PNG', M, 44, 70, 55);
    doc.setFont('Barlow', 'normal'); color(C.white); doc.setFontSize(52);
    doc.text('PERSONAL BRAND', M, 190); color(C.gold); doc.text('PLAYBOOK', M, 240);
    rule(268, 300);
    color(C.white); doc.setFont('Barlow', 'normal'); doc.setFontSize(30); doc.text(txt(me.name).toUpperCase(), M, 316);
    doc.setFont('Inter', 'normal'); doc.setFontSize(12); color(C.muted);
    doc.text([txt(me.sport), txt(me.school)].filter(Boolean).join('  ·  '), M, 338);
    const handles = [me.instagram && 'Instagram @' + me.instagram, me.tiktok && 'TikTok @' + me.tiktok].filter(Boolean).join('    ');
    if (handles) { color(C.gold); doc.text(handles, M, 358); }
    const intro = txt(A('define', 'intro'));
    if (intro) {
      doc.setFont('Inter', 'normal'); doc.setFontSize(12); color(C.white);
      doc.text(doc.splitTextToSize('“' + intro + '”', 330).slice(0, 6), M, 400, { lineHeightFactor: 1.5 });
    }
    doc.setFontSize(8); color(C.muted);
    doc.text('Created ' + new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }), M, H - 40);
    const coverPics = board.filter(b => b.photo && photos[b.photo]).slice(0, 4);
    const gx = 430, gy = 44, gw = W - M - gx, gh = H - 88;
    if (coverPics.length) {
      const slots = coverPics.length === 1 ? [[0, 0, gw, gh]] :
        coverPics.length === 2 ? [[0, 0, gw, gh / 2 - 4], [0, gh / 2 + 4, gw, gh / 2 - 4]] :
        coverPics.length === 3 ? [[0, 0, gw, gh * 0.58], [0, gh * 0.58 + 8, gw / 2 - 4, gh * 0.42 - 8], [gw / 2 + 4, gh * 0.58 + 8, gw / 2 - 4, gh * 0.42 - 8]] :
        [[0, 0, gw / 2 - 4, gh / 2 - 4], [gw / 2 + 4, 0, gw / 2 - 4, gh / 2 - 4], [0, gh / 2 + 4, gw / 2 - 4, gh / 2 - 4], [gw / 2 + 4, gh / 2 + 4, gw / 2 - 4, gh / 2 - 4]];
      for (let i = 0; i < slots.length; i++) {
        const [x, y, w, h] = slots[i]; const u = await cover(photos[coverPics[i].photo], w, h);
        if (u) doc.addImage(u, 'JPEG', gx + x, gy + y, w, h);
      }
    } else {
      fill(C.panel); doc.rect(gx, gy, gw, gh, 'F');
      doc.setFont('Barlow', 'normal'); doc.setFontSize(120); color([40, 40, 40]); doc.text('98', gx + gw / 2, gy + gh / 2 + 40, { align: 'center' });
    }

    /* 2. Who I am beyond my sport */
    if (has(A('discover', 'people'), A('discover', 'interests'), A('discover', 'roots'), intro)) {
      newPage(C.black, 'Session 01 · Discover');
      let y = title('Beyond my sport', 104); rule(y + 4);
      const cw = (W - 2 * M - 28) / 3;
      [['My people', 'people'], ['My interests', 'interests'], ['My roots', 'roots']].forEach(([l, k], i) =>
        box(M + i * (cw + 14), 140, cw, 200, l, A('discover', k)));
      box(M, 356, W - 2 * M, 190, 'My introduction', intro || A('define', 'know'), { bg: C.cream, fg: C.ink, size: 14, labelColor: C.ink });
    }

    /* 3. Mood board */
    if (board.length) {
      newPage(C.black, 'My mood board');
      let y = title('My mood board', 104); rule(y + 4);
      const why = ['why1', 'why2', 'why3'].map(k => txt(A('discover', k))).filter(Boolean);
      const gridW = why.length ? 500 : W - 2 * M, cols = board.length > 6 ? 4 : board.length > 3 ? 3 : board.length;
      const rows = Math.ceil(board.length / cols), gap = 8, top = 132, avail = H - top - 50;
      const tw = (gridW - gap * (cols - 1)) / cols, th = Math.min(tw * 1.05, (avail - gap * (rows - 1)) / rows);
      for (let i = 0; i < board.length; i++) {
        const b = board[i], x = M + (i % cols) * (tw + gap), yy = top + Math.floor(i / cols) * (th + gap);
        const u = b.photo && photos[b.photo] ? await cover(photos[b.photo], tw, th) : null;
        if (u) doc.addImage(u, 'JPEG', x, yy, tw, th); else { fill(C.gold); doc.rect(x, yy, tw, th, 'F'); }
        // caption band
        const capH = 28; doc.setGState(new doc.GState({ opacity: 0.82 })); fill(C.black); doc.rect(x, yy + th - capH, tw, capH, 'F'); doc.setGState(new doc.GState({ opacity: 1 }));
        doc.setFont('Barlow', 'normal'); doc.setFontSize(9); color(C.gold); doc.text(txt(b.cat || 'Pick').toUpperCase(), x + 6, yy + th - capH + 11);
        doc.setFont('Inter', 'normal'); doc.setFontSize(7.5); color(C.white);
        doc.text(doc.splitTextToSize(txt(b.what), tw - 12)[0] || '', x + 6, yy + th - 6);
      }
      if (why.length) {
        const wx = M + gridW + 20, ww = W - M - wx;
        doc.setFont('Barlow', 'normal'); doc.setFontSize(16); color(C.gold); doc.text('WHY THESE CHOICES MATTER', wx, top + 12);
        let wy = top + 30;
        why.forEach(w => {
          doc.setFont('Inter', 'normal'); doc.setFontSize(10); color(C.white);
          const ls = doc.splitTextToSize('“' + w + '”', ww - 12).slice(0, 7);
          fill(C.gold); doc.rect(wx, wy - 9, 2, ls.length * 14.5, 'F');
          doc.text(ls, wx + 10, wy, { lineHeightFactor: 1.45 }); wy += ls.length * 14.5 + 18;
        });
      }
    }

    /* 4. What matters + what I want */
    const v1 = A('define', 'value1'), v2 = A('define', 'value2');
    if (has(v1, v2, A('define', 'goal2'), A('discover', 'goal1'), A('discover', 'notice'))) {
      newPage(C.black, 'Session 02 · Define');
      let y = title('What matters. What I want.', 104); rule(y + 4);
      const cw = (W - 2 * M - 14) / 2;
      box(M, 140, cw, 120, 'Value 01', v1 || A('discover', 'notice'));
      box(M + cw + 14, 140, cw, 120, 'Value 02', v2);
      box(M, 274, cw, 150, 'My goal', A('define', 'goal2'), { bg: C.gold, fg: C.ink, size: 12 });
      box(M + cw + 14, 274, cw, 150, 'What progress looks like', A('define', 'progress'));
      box(M, 438, W - 2 * M, 108, 'One thing I want to try', A('discover', 'goal1'), { bg: C.cream, fg: C.ink, labelColor: C.ink });
    }

    /* 5. What I could share */
    const ideas = [['The little details', 's_details'], ["Something I'm learning", 's_learning'], ['An everyday routine', 's_routine']];
    if (has(...ideas.map(i => A('define', i[1])), A('define', 'share'))) {
      newPage(C.cream, 'Session 02 · Define');
      let y = title('What I could share', 104, 40, C.ink); rule(y + 4);
      const cw = (W - 2 * M - 28) / 3;
      ideas.forEach(([l, k], i) => box(M + i * (cw + 14), 140, cw, 240, l, A('define', k), { bg: C.black }));
      box(M, 396, W - 2 * M, 150, 'Something I might share', A('define', 'share'), { bg: C.black, size: 11 });
    }

    /* 6. My plan */
    const c = A('act', 'commit') || {};
    const plan = { will: A('act', 'c_will') || c.will, when: A('act', 'c_when') || c.when, blocks: A('act', 'c_blocks') || c.blocks,
      fb: A('act', 'c_feedback') || [c.who, c.what].filter(Boolean).join(' · ') };
    const ideas6 = (A('act', 'ideas') || []).filter(Boolean);
    if (has(A('act', 'gap'), A('act', 'theme1'), A('act', 'bio'), plan.will, ideas6.join(''))) {
      newPage(C.black, 'Session 03 · Act');
      let y = title('My plan', 104); rule(y + 4);
      const cw = (W - 2 * M - 28) / 3;
      box(M, 140, cw, 120, 'The gap I am closing', A('act', 'gap'));
      box(M + cw + 14, 140, cw, 120, 'Content themes', [A('act', 'theme1'), A('act', 'theme2')].filter(Boolean).join('\n'));
      box(M + 2 * (cw + 14), 140, cw, 120, 'Learning focus', [A('act', 'focus'), A('act', 'focusNote')].filter(Boolean).join(' · '));
      box(M, 274, cw, 272, 'Six story ideas', ideas6.map((t, i) => `${i + 1}. ${t}`).join('\n'));
      box(M + cw + 14, 274, cw * 2 + 14, 130, 'My bio', A('act', 'bio'), { bg: C.cream, fg: C.ink, labelColor: C.ink, size: 11 });
      const fd = A('act', 'feedbackDate');
      box(M + cw + 14, 418, cw * 2 + 14, 128, 'My weekly commitment',
        [plan.will && 'This week: ' + plan.will, plan.when && 'When: ' + plan.when, plan.blocks && 'Work blocks: ' + plan.blocks,
         plan.fb && 'Feedback: ' + plan.fb, fd && 'Check-in: ' + fd].filter(Boolean).join('\n'), { bg: C.gold, fg: C.ink, size: 9.5 });
    }

    /* Back page */
    newPage(C.black);
    if (logo) doc.addImage(logo, 'PNG', W / 2 - 50, 190, 100, 79);
    doc.setFont('Barlow', 'normal'); doc.setFontSize(30); color(C.white);
    doc.text('YOUR ATHLETIC ABILITY IS THE STARTING POINT.', W / 2, 330, { align: 'center' });
    color(C.gold); doc.text('THIS IS YOUR STORY.', W / 2, 366, { align: 'center' });
    doc.setFont('Inter', 'normal'); doc.setFontSize(10); color(C.muted);
    doc.text('Speak with your 98Strong representative to confirm your next session date.', W / 2, 400, { align: 'center' });
    return doc;
  };
})();
