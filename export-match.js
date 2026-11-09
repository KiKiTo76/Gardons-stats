(function (root) {
  var C = { orange: "FFA300", black: "000000", dark: "1D1D20", white: "FFFFFF", zebra: "F5F5F2", line: "D9D9D4", goodBg: "D7F0DD", badBg: "F8D7D7", good: "1E7B3A", bad: "B3261E", muted: "6B6B72" };

  function esc(s) {
    return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function colName(n) {
    var s = "";
    while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }

  function ref(r, c) { return colName(c) + r; }

  function Styles() {
    this.fonts = ['<font><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/><family val="2"/></font>'];
    this.fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    this.borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
    this.fmts = [];
    this.xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    this.cache = {};
    this.dxfs = [];
  }

  Styles.prototype.pick = function (list, xml) {
    var i = list.indexOf(xml);
    if (i < 0) { list.push(xml); i = list.length - 1; }
    return i;
  };

  Styles.prototype.fmtId = function (code) {
    if (!code) return 0;
    if (code === "0") return 1;
    if (code === "0%") return 9;
    return 164 + this.pick(this.fmts, code);
  };

  Styles.prototype.get = function (o) {
    if (!o) return 0;
    var key = JSON.stringify(o);
    if (this.cache[key] != null) return this.cache[key];
    var font = "<font>" + (o.b ? "<b/>" : "") + (o.i ? "<i/>" : "") + '<sz val="' + (o.sz || 11) + '"/><color rgb="FF' + (o.color || C.black) + '"/><name val="Calibri"/><family val="2"/></font>';
    var fill = o.bg ? '<fill><patternFill patternType="solid"><fgColor rgb="FF' + o.bg + '"/><bgColor indexed="64"/></patternFill></fill>' : null;
    var side = function (n) { return "<" + n + ' style="thin"><color rgb="FF' + C.line + '"/></' + n + ">"; };
    var border = o.border ? "<border>" + side("left") + side("right") + side("top") + side("bottom") + "<diagonal/></border>" : null;
    var fontId = this.pick(this.fonts, font);
    var fillId = fill ? this.pick(this.fills, fill) : 0;
    var borderId = border ? this.pick(this.borders, border) : 0;
    var numId = this.fmtId(o.fmt);
    var al = "";
    if (o.h || o.v || o.ind || o.wrap) {
      al = "<alignment" + (o.h ? ' horizontal="' + o.h + '"' : "") + (o.v ? ' vertical="' + o.v + '"' : "") + (o.ind ? ' indent="' + o.ind + '"' : "") + (o.wrap ? ' wrapText="1"' : "") + "/>";
    }
    var xf = '<xf numFmtId="' + numId + '" fontId="' + fontId + '" fillId="' + fillId + '" borderId="' + borderId + '" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"' + (al ? ' applyAlignment="1">' + al + "</xf>" : "/>");
    this.xfs.push(xf);
    this.cache[key] = this.xfs.length - 1;
    return this.cache[key];
  };

  Styles.prototype.dxf = function (color, bg) {
    var xml = '<dxf><font><b/><color rgb="FF' + color + '"/></font><fill><patternFill><bgColor rgb="FF' + bg + '"/></patternFill></fill></dxf>';
    return this.pick(this.dxfs, xml);
  };

  Styles.prototype.xml = function () {
    var list = function (tag, arr) { return "<" + tag + ' count="' + arr.length + '">' + arr.join("") + "</" + tag + ">"; };
    var fm = this.fmts.length ? '<numFmts count="' + this.fmts.length + '">' + this.fmts.map(function (f, i) { return '<numFmt numFmtId="' + (164 + i) + '" formatCode="' + esc(f) + '"/>'; }).join("") + "</numFmts>" : "";
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + fm +
      list("fonts", this.fonts) + list("fills", this.fills) + list("borders", this.borders) +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' + list("cellXfs", this.xfs) +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' + list("dxfs", this.dxfs) + "</styleSheet>";
  };

  function Sheet(name, styles) {
    this.name = name; this.st = styles; this.rows = {}; this.merges = []; this.cols = []; this.heights = {};
    this.freeze = null; this.filter = null; this.cf = []; this.landscape = false; this.maxR = 1; this.maxC = 1;
  }

  Sheet.prototype.set = function (r, c, v, style) {
    var row = this.rows[r] || (this.rows[r] = {});
    row[c] = { v: v, s: this.st.get(style) };
    if (r > this.maxR) this.maxR = r;
    if (c > this.maxC) this.maxC = c;
  };

  Sheet.prototype.merge = function (r1, c1, r2, c2, v, style) {
    for (var r = r1; r <= r2; r++) for (var c = c1; c <= c2; c++) this.set(r, c, r === r1 && c === c1 ? v : null, style);
    this.merges.push(ref(r1, c1) + ":" + ref(r2, c2));
  };

  Sheet.prototype.height = function (r, h) { this.heights[r] = h; };

  Sheet.prototype.cellXml = function (r, c, cell) {
    var a = ' r="' + ref(r, c) + '"' + (cell.s ? ' s="' + cell.s + '"' : "");
    var v = cell.v;
    if (v == null || v === "") return "<c" + a + "/>";
    if (typeof v === "number") return isFinite(v) ? "<c" + a + "><v>" + v + "</v></c>" : "<c" + a + "/>";
    if (typeof v === "object") {
      if (typeof v.v === "number") return "<c" + a + "><f>" + esc(v.f) + "</f><v>" + v.v + "</v></c>";
      return "<c" + a + ' t="str"><f>' + esc(v.f) + "</f><v>" + esc(v.v == null ? "" : v.v) + "</v></c>";
    }
    return "<c" + a + ' t="inlineStr"><is><t xml:space="preserve">' + esc(v) + "</t></is></c>";
  };

  Sheet.prototype.xml = function (selected) {
    var self = this;
    var rowNums = Object.keys(this.rows).concat(Object.keys(this.heights)).map(Number).filter(function (r, i, a) { return a.indexOf(r) === i; });
    var rowsXml = rowNums.sort(function (a, b) { return a - b; }).map(function (r) {
      var cells = self.rows[r] || {};
      var h = self.heights[r];
      return '<row r="' + r + '"' + (h ? ' ht="' + h + '" customHeight="1"' : "") + ">" + Object.keys(cells).map(Number).sort(function (a, b) { return a - b; }).map(function (c) { return self.cellXml(r, c, cells[c]); }).join("") + "</row>";
    }).join("");
    var pane = "";
    if (this.freeze) {
      var x = this.freeze.x || 0, y = this.freeze.y || 0;
      var active = x && y ? "bottomRight" : x ? "topRight" : "bottomLeft";
      pane = "<pane" + (x ? ' xSplit="' + x + '"' : "") + (y ? ' ySplit="' + y + '"' : "") + ' topLeftCell="' + ref(y + 1, x + 1) + '" activePane="' + active + '" state="frozen"/>' +
        (x && y ? '<selection pane="topRight"/><selection pane="bottomLeft"/>' : "") + '<selection pane="' + active + '"/>';
    }
    var cols = this.cols.length ? "<cols>" + this.cols.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join("") + "</cols>" : "";
    var cf = this.cf.map(function (g, gi) {
      return '<conditionalFormatting sqref="' + g.ref + '">' + g.rules.map(function (ru, ri) {
        return '<cfRule type="cellIs" dxfId="' + ru.dxf + '" priority="' + (gi * 10 + ri + 1) + '" operator="' + ru.op + '"><formula>' + ru.val + "</formula></cfRule>";
      }).join("") + "</conditionalFormatting>";
    }).join("");
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheetPr><tabColor rgb="FF' + C.orange + '"/><pageSetUpPr fitToPage="1"/></sheetPr>' +
      '<dimension ref="A1:' + ref(this.maxR, this.maxC) + '"/>' +
      '<sheetViews><sheetView showGridLines="0"' + (selected ? ' tabSelected="1"' : "") + ' workbookViewId="0">' + pane + "</sheetView></sheetViews>" +
      '<sheetFormatPr defaultRowHeight="15"/>' + cols + "<sheetData>" + rowsXml + "</sheetData>" +
      (this.filter ? '<autoFilter ref="' + this.filter + '"/>' : "") +
      (this.merges.length ? '<mergeCells count="' + this.merges.length + '">' + this.merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join("") + "</mergeCells>" : "") +
      cf + '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>' +
      '<pageSetup paperSize="9" orientation="' + (this.landscape ? "landscape" : "portrait") + '" fitToWidth="1" fitToHeight="0"/></worksheet>';
  };

  function hdr(first) { return { b: true, color: C.orange, bg: C.black, border: true, h: first ? "left" : "center", v: "center", wrap: true, ind: first ? 1 : 0 }; }
  function body(zebra, o) {
    o = o || {};
    return { border: true, bg: o.bg || (zebra ? C.zebra : null), b: !!o.b, color: o.color, h: o.left ? "left" : "center", v: "center", ind: o.left ? 1 : 0, wrap: !!o.wrap, fmt: o.fmt };
  }
  function totalCell(left) { return { b: true, color: C.orange, bg: C.black, border: true, h: left ? "left" : "center", v: "center", ind: left ? 1 : 0 }; }

  function banner(ws, lastCol, title, sub) {
    ws.merge(1, 1, 1, lastCol, title, { b: true, sz: 20, color: C.white, bg: C.black, h: "left", v: "center", ind: 1 });
    ws.height(1, 36);
    ws.merge(2, 1, 2, lastCol, sub, { sz: 11, color: C.orange, bg: C.dark, h: "left", v: "center", ind: 1 });
    ws.height(2, 22);
    ws.merge(3, 1, 3, lastCol, null, { bg: C.orange });
    ws.height(3, 4);
    ws.height(4, 8);
  }

  function fmtFor(kind) {
    if (kind === "pct") return "0%";
    if (kind === "dec") return "0.0";
    if (kind === "diff") return "+0;-0;0";
    return "0";
  }

  function conv(v, kind) { return v == null ? null : kind === "pct" ? v / 100 : v; }
  function r6(v) { return Math.round(v * 1e6) / 1e6; }
  function sumF(col, a, b) { return "SUM(" + col + a + ":" + col + b + ")"; }
  function ratioF(w, l, r) { return "IF(" + w + r + "+" + l + r + "=0,\"\"," + w + r + "/(" + w + r + "+" + l + r + "))"; }

  function tierTable(ws, r, d, lastLabel) {
    ["Statistique", "Tier 1", "Tier 2", "Tier 3", lastLabel].forEach(function (l, i) { ws.set(r, i + 1, l, hdr(i === 0)); });
    ws.height(r, 24);
    r++;
    d.groups.forEach(function (g) {
      ws.merge(r, 1, r, 5, g.title.toUpperCase(), { b: true, i: true, bg: C.orange, h: "left", v: "center", ind: 1 });
      ws.height(r, 20);
      r++;
      g.specs.forEach(function (sp, si) {
        var zebra = si % 2 === 1;
        ws.set(r, 1, sp.l, body(zebra, { left: true }));
        var vals = [0, 1, 2].map(function (ti) { var t = d.tiers[ti]; return t.has && t.m[sp.k] != null ? r6(t.m[sp.k]) : null; });
        var present = vals.filter(function (v) { return v != null; });
        var best = null, worst = null;
        if (sp.dir && present.length >= 2) {
          var mx = Math.max.apply(null, present), mn = Math.min.apply(null, present);
          if (mx !== mn) { best = sp.dir > 0 ? mx : mn; worst = sp.dir > 0 ? mn : mx; }
        }
        vals.forEach(function (v, i) {
          var o = { fmt: fmtFor(sp.kind) };
          if (v != null && v === best) { o.bg = C.goodBg; o.color = C.good; o.b = true; }
          else if (v != null && v === worst) { o.bg = C.badBg; o.color = C.bad; o.b = true; }
          ws.set(r, 2 + i, v == null ? "-" : conv(v, sp.kind), body(zebra, o));
        });
        var tot = d.tiers[3].m[sp.k];
        ws.set(r, 5, tot == null ? "-" : conv(r6(tot), sp.kind), body(zebra, { b: true, fmt: fmtFor(sp.kind) }));
        r++;
      });
    });
    return r;
  }

  function sheetSummary(wb, d) {
    var ws = wb.add("Résumé");
    ws.cols = [30, 14, 14, 14, 14];
    banner(ws, 5, d.team.toUpperCase() + "  vs  " + d.opponent.toUpperCase(), d.date + "  -  " + (d.home ? "Domicile" : "Extérieur") + (d.season ? "  -  Saison " + d.season : ""));
    ws.merge(5, 1, 5, 5, d.team + "  " + d.gf + " - " + d.ga + "  " + d.opponent, { b: true, sz: 22, bg: C.zebra, h: "center", v: "center" });
    ws.height(5, 42);
    ws.merge(6, 1, 6, 5, d.result.toUpperCase(), { b: true, sz: 12, color: d.result === "Victoire" ? C.good : d.result === "Défaite" ? C.bad : C.muted, bg: C.zebra, h: "center", v: "center" });
    ws.height(6, 22);
    var r = 8;
    var any = false;
    d.awards.forEach(function (a, i) {
      if (!a) return;
      any = true;
      ws.set(r, 1, d.awardLabels[i], body(false, { b: true, left: true, bg: C.zebra }));
      ws.merge(r, 2, r, 5, a.name + "  (" + a.line + ")", body(false, { left: true }));
      r++;
    });
    if (any) r++;
    r = tierTable(ws, r, d, "Match");
    r++;
    d.notes.forEach(function (n) {
      ws.merge(r, 1, r, 5, n, { sz: 9, i: true, color: C.muted, v: "top", wrap: true });
      ws.height(r, 26);
      r++;
    });
  }

  function sheetPlayers(wb, d) {
    var ws = wb.add("Joueurs");
    ws.landscape = true;
    var heads = ["Ligne", "N°", "Joueur", "Poste", "B", "A", "Pts", "+/-", "Pun. (min)", "HJ", "DI", "MG", "MP", "MG %", "Tirs crit.", "Tirs norm.", "Tirs ratés", "Danger"];
    ws.cols = [8, 6, 26, 8, 6, 6, 6, 7, 10, 6, 6, 7, 7, 8, 9, 9, 9, 9];
    banner(ws, heads.length, "JOUEURS DE CHAMP", d.team + " vs " + d.opponent + "  -  " + d.date);
    var hr = 5;
    heads.forEach(function (l, i) { ws.set(hr, i + 1, l, hdr(false)); });
    ws.height(hr, 24);
    var first = hr + 1, rows = d.skaters, last = first + rows.length - 1;
    rows.forEach(function (p, i) {
      var r = first + i, zebra = i % 2 === 1;
      var fp = p.fw + p.fl ? p.fw / (p.fw + p.fl) : "";
      var vals = [p.line ? "L" + p.line : "-", p.num, p.name, p.pos === "A" ? "Att." : p.pos === "D" ? "Déf." : p.pos, p.g, p.a, { f: "E" + r + "+F" + r, v: p.g + p.a }, p.pm, p.pim, p.hj, p.di, p.fw, p.fl, { f: ratioF("L", "M", r), v: fp }, p.shc, p.shn, p.shm, p.danger];
      vals.forEach(function (v, ci) {
        ws.set(r, ci + 1, v, body(zebra, { left: ci === 2, b: ci === 6, fmt: ci === 7 ? "+0;-0;0" : ci === 13 ? "0%" : ci === 17 ? "0.0" : undefined }));
      });
    });
    if (rows.length) {
      var tr = last + 1;
      var sum = function (k) { return rows.reduce(function (a, p) { return a + k(p); }, 0); };
      var res = { E: sum(function (p) { return p.g; }), F: sum(function (p) { return p.a; }), G: sum(function (p) { return p.g + p.a; }), H: sum(function (p) { return p.pm; }), I: sum(function (p) { return p.pim; }), J: sum(function (p) { return p.hj; }), K: sum(function (p) { return p.di; }), L: sum(function (p) { return p.fw; }), M: sum(function (p) { return p.fl; }), O: sum(function (p) { return p.shc; }), P: sum(function (p) { return p.shn; }), Q: sum(function (p) { return p.shm; }), R: sum(function (p) { return p.danger; }) };
      "ABCDEFGHIJKLMNOPQR".split("").forEach(function (col, ci) {
        var st = totalCell(col === "C");
        if (col === "H") st.fmt = "+0;-0;0";
        if (col === "N") st.fmt = "0%";
        if (col === "R") st.fmt = "0.0";
        var v = null;
        if (col === "C") v = "TOTAL";
        else if (res[col] != null) v = { f: sumF(col, first, last), v: res[col] };
        else if (col === "N") v = { f: ratioF("L", "M", tr), v: res.L + res.M ? res.L / (res.L + res.M) : "" };
        ws.set(tr, ci + 1, v, st);
      });
      ws.height(tr, 22);
      var g = wb.styles.dxf(C.good, C.goodBg), b = wb.styles.dxf(C.bad, C.badBg);
      ws.cf.push({ ref: "H" + first + ":H" + last, rules: [{ op: "greaterThan", val: 0, dxf: g }, { op: "lessThan", val: 0, dxf: b }] });
      ws.filter = "A" + hr + ":R" + last;
      wb.filters.push({ sheet: ws, ref: "$A$" + hr + ":$R$" + last });
    }
    ws.merge(rows.length ? last + 3 : hr + 2, 1, rows.length ? last + 3 : hr + 2, heads.length, "HJ : hors-jeu. DI : dégagement interdit. MG / MP : mises au jeu gagnées / perdues. Danger : critique x2, normal x1,5, raté x1.", { sz: 9, i: true, color: C.muted });
    ws.freeze = { x: 3, y: hr };
  }

  function sheetGoalies(wb, d) {
    var ws = wb.add("Gardiens");
    ws.landscape = true;
    var heads = ["N°", "Gardien", "Statut", "Tirs reçus", "Arrêts crit.", "Arrêts norm.", "Arrêts pond.", "Buts encaissés", "% arrêts", "Tirs adv. ratés"];
    ws.cols = [6, 26, 12, 11, 11, 11, 12, 12, 10, 12];
    banner(ws, heads.length, "GARDIENS", d.team + " vs " + d.opponent + "  -  " + d.date);
    heads.forEach(function (l, i) { ws.set(5, i + 1, l, hdr(false)); });
    ws.height(5, 24);
    d.goalies.forEach(function (g, i) {
      var r = 6 + i, zebra = i % 2 === 1;
      var pct = g.sh ? (g.svc + g.svn) / g.sh : "";
      var vals = [g.num, g.name, g.status, g.sh, g.svc, g.svn, { f: "E" + r + "*2+F" + r, v: g.svw }, g.ga, { f: "IF(D" + r + "=0,\"\",(E" + r + "+F" + r + ")/D" + r + ")", v: pct }, g.adm];
      vals.forEach(function (v, ci) { ws.set(r, ci + 1, v, body(zebra, { left: ci === 1, b: ci === 8, fmt: ci === 8 ? "0%" : ci === 6 ? "0.0" : undefined })); });
    });
    if (!d.goalies.length) ws.merge(6, 1, 6, heads.length, "Aucun gardien avec activité sur ce match.", { i: true, color: C.muted });
  }

  function sheetFaceoffs(wb, d) {
    var rows = d.skaters.filter(function (p) { return p.fw + p.fl > 0; });
    if (!rows.length) return;
    var ws = wb.add("Mises au jeu");
    ws.cols = [6, 26, 9, 9, 9, 9, 9, 9, 10, 10, 12];
    banner(ws, 11, "MISES AU JEU", d.team + " vs " + d.opponent + "  -  " + d.date);
    ws.set(5, 1, null, hdr(false)); ws.set(5, 2, null, hdr(false));
    [["Tier 1", 3], ["Tier 2", 5], ["Tier 3", 7], ["Match", 9]].forEach(function (g) {
      ws.merge(5, g[1], 5, g[1] + 1, g[0], { b: true, bg: C.orange, border: true, h: "center", v: "center" });
    });
    ws.set(5, 11, null, hdr(false));
    ["N°", "Joueur", "G", "P", "G", "P", "G", "P", "G", "P", "% gagnées"].forEach(function (l, i) { ws.set(6, i + 1, l, hdr(false)); });
    ws.height(6, 24);
    var first = 7;
    var tot = function (p, k) { return p.fo && p.fo[k] ? p.fo[k] : { w: 0, l: 0 }; };
    rows.sort(function (a, b) { return (b.fw - a.fw) || (a.fl - b.fl) || (a.num - b.num); });
    rows.forEach(function (p, i) {
      var r = first + i, zebra = i % 2 === 1;
      var w = p.fw, l = p.fl;
      var vals = [p.num, p.name, tot(p, 1).w, tot(p, 1).l, tot(p, 2).w, tot(p, 2).l, tot(p, 3).w, tot(p, 3).l, { f: "C" + r + "+E" + r + "+G" + r, v: w }, { f: "D" + r + "+F" + r + "+H" + r, v: l }, { f: ratioF("I", "J", r), v: w + l ? w / (w + l) : "" }];
      vals.forEach(function (v, ci) { ws.set(r, ci + 1, v, body(zebra, { left: ci === 1, b: ci >= 8, fmt: ci === 10 ? "0%" : undefined })); });
    });
    var last = first + rows.length - 1, tr = last + 1;
    var tw = function (k) { return rows.reduce(function (a, p) { return a + tot(p, k).w; }, 0); };
    var tl = function (k) { return rows.reduce(function (a, p) { return a + tot(p, k).l; }, 0); };
    var res = { C: tw(1), D: tl(1), E: tw(2), F: tl(2), G: tw(3), H: tl(3) };
    res.I = res.C + res.E + res.G; res.J = res.D + res.F + res.H;
    "ABCDEFGHIJK".split("").forEach(function (col, ci) {
      var st = totalCell(col === "B");
      if (col === "K") st.fmt = "0%";
      var v = null;
      if (col === "B") v = "TOTAL";
      else if (res[col] != null) v = { f: sumF(col, first, last), v: res[col] };
      else if (col === "K") v = { f: ratioF("I", "J", tr), v: res.I + res.J ? res.I / (res.I + res.J) : "" };
      ws.set(tr, ci + 1, v, st);
    });
    ws.height(tr, 22);
    ws.freeze = { x: 2, y: 6 };
  }

  function sheetGoals(wb, d) {
    var ws = wb.add("Buts");
    ws.landscape = true;
    var heads = ["Tier", "Heure", "Type", "Joueur", "Passes", "Sur la glace", "Situation", "Score"];
    ws.cols = [7, 9, 15, 26, 34, 40, 14, 9];
    banner(ws, heads.length, "BUTS", d.team + " vs " + d.opponent + "  -  " + d.date);
    heads.forEach(function (l, i) { ws.set(5, i + 1, l, hdr(false)); });
    ws.height(5, 24);
    d.goals.forEach(function (g, i) {
      var r = 6 + i, zebra = i % 2 === 1, isGoal = g.type === "But";
      [g.per, g.time, g.type, g.who, g.ast || "-", g.ice || "-", g.sit, g.score].forEach(function (v, ci) {
        var o = { left: ci >= 3 && ci <= 5, wrap: ci >= 4 && ci <= 5, b: ci === 2 || ci === 7 };
        if (ci === 2) { o.color = isGoal ? C.good : C.bad; o.bg = isGoal ? C.goodBg : C.badBg; }
        ws.set(r, ci + 1, v, body(zebra, o));
      });
    });
    if (!d.goals.length) ws.merge(6, 1, 6, heads.length, "Aucun but dans ce match.", { i: true, color: C.muted });
    ws.freeze = { y: 5 };
  }

  function sheetFeed(wb, d) {
    var ws = wb.add("Fil du match");
    ws.cols = [9, 7, 90];
    banner(ws, 3, "FIL DU MATCH", d.team + " vs " + d.opponent + "  -  " + d.date);
    ["Heure", "Tier", "Événement"].forEach(function (l, i) { ws.set(5, i + 1, l, hdr(false)); });
    ws.height(5, 24);
    d.events.forEach(function (e, i) {
      var r = 6 + i, zebra = i % 2 === 1;
      var color = e.type === "goal" ? C.good : e.type === "ga" ? C.bad : undefined;
      var b = e.type === "goal" || e.type === "ga";
      [e.time, e.per, e.text].forEach(function (v, ci) { ws.set(r, ci + 1, v, body(zebra, { left: ci === 2, b: b, color: color })); });
    });
    ws.freeze = { y: 5 };
    var last = 5 + Math.max(d.events.length, 1);
    ws.filter = "A5:C" + last;
    wb.filters.push({ sheet: ws, ref: "$A$5:$C$" + last });
  }

  function sheetSeasonTeam(wb, d) {
    var ws = wb.add("Équipe");
    ws.cols = [30, 14, 14, 14, 14];
    banner(ws, 5, d.team.toUpperCase() + "  -  STATISTIQUES", d.label + "  -  " + d.played + " match(s) terminé(s)");
    var r = 5;
    var rec = d.record;
    [["Matchs joués", rec.gp], ["Victoires", rec.w], ["Défaites", rec.l], ["Nuls", rec.n], ["Buts pour", rec.gf], ["Buts contre", rec.ga], ["Différentiel", rec.gf - rec.ga]].forEach(function (x, i) {
      ws.set(r, 1, x[0], body(false, { b: true, left: true, bg: C.zebra }));
      ws.merge(r, 2, r, 5, x[1], body(false, { left: true, b: true, fmt: i === 6 ? "+0;-0;0" : "0" }));
      r++;
    });
    r++;
    if (!d.played) {
      ws.merge(r, 1, r, 5, "Pas encore de statistiques : elles apparaissent dès qu'un match est terminé.", { i: true, color: C.muted });
    } else {
      r = tierTable(ws, r, d, "Cumul");
      r++;
      d.notes.forEach(function (n) {
        ws.merge(r, 1, r, 5, n, { sz: 9, i: true, color: C.muted, v: "top", wrap: true });
        ws.height(r, 26);
        r++;
      });
    }
  }

  function sheetSeasonPlayers(wb, d) {
    var ws = wb.add("Joueurs");
    ws.landscape = true;
    var heads = ["N°", "Joueur", "Poste", "MJ", "B", "A", "Pts", "Pts/MJ", "+/-", "Pun. (min)", "HJ", "DI", "MG", "MP", "MG %", "Tirs crit.", "Tirs norm.", "Tirs ratés", "Danger"];
    ws.cols = [6, 26, 8, 6, 6, 6, 6, 8, 7, 10, 6, 6, 7, 7, 8, 9, 9, 9, 9];
    banner(ws, heads.length, "JOUEURS DE CHAMP", d.team + "  -  " + d.label);
    var hr = 5;
    heads.forEach(function (l, i) { ws.set(hr, i + 1, l, hdr(false)); });
    ws.height(hr, 24);
    var first = hr + 1, rows = d.skaters, last = first + rows.length - 1;
    rows.forEach(function (p, i) {
      var r = first + i, zebra = i % 2 === 1;
      var vals = [p.num, p.name, p.pos === "A" ? "Att." : p.pos === "D" ? "Déf." : p.pos, p.gp, p.g, p.a, { f: "E" + r + "+F" + r, v: p.g + p.a }, { f: "IF(D" + r + "=0,\"\",G" + r + "/D" + r + ")", v: p.gp ? (p.g + p.a) / p.gp : "" }, p.pm, p.pim, p.hj, p.di, p.fw, p.fl, { f: ratioF("M", "N", r), v: p.fw + p.fl ? p.fw / (p.fw + p.fl) : "" }, p.shc, p.shn, p.shm, p.danger];
      vals.forEach(function (v, ci) {
        ws.set(r, ci + 1, v, body(zebra, { left: ci === 1, b: ci === 6, fmt: ci === 7 ? "0.00" : ci === 8 ? "+0;-0;0" : ci === 14 ? "0%" : ci === 18 ? "0.0" : undefined }));
      });
    });
    if (rows.length) {
      var tr = last + 1;
      var sum = function (k) { return rows.reduce(function (a, p) { return a + k(p); }, 0); };
      var res = { E: sum(function (p) { return p.g; }), F: sum(function (p) { return p.a; }), G: sum(function (p) { return p.g + p.a; }), I: sum(function (p) { return p.pm; }), J: sum(function (p) { return p.pim; }), K: sum(function (p) { return p.hj; }), L: sum(function (p) { return p.di; }), M: sum(function (p) { return p.fw; }), N: sum(function (p) { return p.fl; }), P: sum(function (p) { return p.shc; }), Q: sum(function (p) { return p.shn; }), R: sum(function (p) { return p.shm; }), S: sum(function (p) { return p.danger; }) };
      "ABCDEFGHIJKLMNOPQRS".split("").forEach(function (col, ci) {
        var st = totalCell(col === "B");
        if (col === "I") st.fmt = "+0;-0;0";
        if (col === "O") st.fmt = "0%";
        if (col === "S") st.fmt = "0.0";
        var v = null;
        if (col === "B") v = "TOTAL";
        else if (res[col] != null) v = { f: sumF(col, first, last), v: res[col] };
        else if (col === "O") v = { f: ratioF("M", "N", tr), v: res.M + res.N ? res.M / (res.M + res.N) : "" };
        ws.set(tr, ci + 1, v, st);
      });
      ws.height(tr, 22);
      var g = wb.styles.dxf(C.good, C.goodBg), b = wb.styles.dxf(C.bad, C.badBg);
      ws.cf.push({ ref: "I" + first + ":I" + last, rules: [{ op: "greaterThan", val: 0, dxf: g }, { op: "lessThan", val: 0, dxf: b }] });
      ws.filter = "A" + hr + ":S" + last;
      wb.filters.push({ sheet: ws, ref: "$A$" + hr + ":$S$" + last });
    } else {
      ws.merge(hr + 1, 1, hr + 1, heads.length, "Pas encore de statistiques.", { i: true, color: C.muted });
    }
    var nr = rows.length ? last + 3 : hr + 3;
    ws.merge(nr, 1, nr, heads.length, "MJ : matchs joués. HJ : hors-jeu. DI : dégagement interdit. MG / MP : mises au jeu gagnées / perdues. Danger : critique x2, normal x1,5, raté x1.", { sz: 9, i: true, color: C.muted });
    ws.freeze = { x: 2, y: hr };
  }

  function sheetSeasonGoalies(wb, d) {
    var ws = wb.add("Gardiens");
    ws.landscape = true;
    var heads = ["Gardien", "MJ", "Victoires", "Tirs reçus", "Arrêts crit.", "Arrêts norm.", "Arrêts pond.", "Buts encaissés", "% arrêts", "B", "A"];
    ws.cols = [26, 6, 10, 11, 11, 11, 12, 12, 10, 6, 6];
    banner(ws, heads.length, "GARDIENS", d.team + "  -  " + d.label);
    heads.forEach(function (l, i) { ws.set(5, i + 1, l, hdr(false)); });
    ws.height(5, 24);
    d.goalies.forEach(function (g, i) {
      var r = 6 + i, zebra = i % 2 === 1;
      var vals = [g.name, g.gp, g.w, g.sh, g.svc, g.svn, { f: "E" + r + "*2+F" + r, v: g.svw }, g.ga, { f: "IF(D" + r + "=0,\"\",(E" + r + "+F" + r + ")/D" + r + ")", v: g.sh ? (g.svc + g.svn) / g.sh : "" }, g.g, g.a];
      vals.forEach(function (v, ci) { ws.set(r, ci + 1, v, body(zebra, { left: ci === 0, b: ci === 8, fmt: ci === 8 ? "0.0%" : ci === 6 ? "0.0" : undefined })); });
    });
    if (!d.goalies.length) ws.merge(6, 1, 6, heads.length, "Aucune donnée gardien.", { i: true, color: C.muted });
  }

  function sheetSeasonMatches(wb, d) {
    var ws = wb.add("Matchs");
    var heads = ["Date", "Adversaire", "Lieu", "Gardons", "Adverse", "Résultat"];
    ws.cols = [14, 28, 12, 11, 11, 13];
    banner(ws, heads.length, "MATCHS", d.team + "  -  " + d.label);
    heads.forEach(function (l, i) { ws.set(5, i + 1, l, hdr(false)); });
    ws.height(5, 24);
    d.matches.forEach(function (m, i) {
      var r = 6 + i, zebra = i % 2 === 1;
      var res = m.result;
      var o = { b: true };
      if (res === "Victoire") { o.color = C.good; o.bg = C.goodBg; } else if (res === "Défaite") { o.color = C.bad; o.bg = C.badBg; }
      [m.date, m.opponent, m.home ? "Domicile" : "Extérieur", m.gf, m.ga, res].forEach(function (v, ci) {
        ws.set(r, ci + 1, v, body(zebra, ci === 5 ? o : { left: ci === 1, fmt: ci === 0 ? "dd/mm/yyyy" : undefined, b: ci === 3 || ci === 4 }));
      });
    });
    if (!d.matches.length) ws.merge(6, 1, 6, heads.length, "Aucun match.", { i: true, color: C.muted });
    ws.freeze = { y: 5 };
    if (d.matches.length) {
      ws.filter = "A5:F" + (5 + d.matches.length);
      wb.filters.push({ sheet: ws, ref: "$A$5:$F$" + (5 + d.matches.length) });
    }
  }

  function newBook() {
    var wb = { styles: new Styles(), sheets: [], filters: [] };
    wb.add = function (name) { var s = new Sheet(name, wb.styles); wb.sheets.push(s); return s; };
    return wb;
  }

  function pack(JSZip, wb) {
    var zip = new JSZip();
    var n = wb.sheets.length;
    var types = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      wb.sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join("") + "</Types>";
    zip.file("[Content_Types].xml", types);
    zip.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    var names = wb.filters.map(function (f) { return '<definedName name="_xlnm._FilterDatabase" localSheetId="' + wb.sheets.indexOf(f.sheet) + '" hidden="1">\'' + f.sheet.name + "'!" + f.ref + "</definedName>"; }).join("");
    zip.file("xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews><sheets>' +
      wb.sheets.map(function (s, i) { return '<sheet name="' + esc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join("") + "</sheets>" + (names ? "<definedNames>" + names + "</definedNames>" : "") + '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>');
    zip.file("xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      wb.sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join("") +
      '<Relationship Id="rId' + (n + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
    wb.sheets.forEach(function (s, i) { zip.file("xl/worksheets/sheet" + (i + 1) + ".xml", s.xml(i === 0)); });
    zip.file("xl/styles.xml", wb.styles.xml());
    return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  function build(JSZip, d) {
    var wb = newBook();
    sheetSummary(wb, d);
    sheetPlayers(wb, d);
    sheetGoalies(wb, d);
    sheetFaceoffs(wb, d);
    sheetGoals(wb, d);
    sheetFeed(wb, d);
    return pack(JSZip, wb);
  }

  function buildSeason(JSZip, d) {
    var wb = newBook();
    sheetSeasonTeam(wb, d);
    sheetSeasonPlayers(wb, d);
    sheetSeasonGoalies(wb, d);
    sheetSeasonMatches(wb, d);
    return pack(JSZip, wb);
  }

  root.buildSeasonXlsx = buildSeason;
  root.buildMatchXlsx = build;
  if (typeof module !== "undefined" && module.exports) module.exports = build;
})(typeof window !== "undefined" ? window : globalThis);
