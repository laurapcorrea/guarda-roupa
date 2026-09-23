/* Guarda-Roupa da Laura — app autônomo (sem servidor) */
(function () {
  "use strict";
  window.addEventListener("error", function (e) { try { e.preventDefault(); } catch (x) {} }, true);

  /* ---------------- constantes ---------------- */
  var EST = { V: "Verão", O: "Outono", I: "Inverno", P: "Primavera" };
  var CATS = [
    { id: "todas", nome: "Tudo" },
    { id: "top", nome: "Cima" },
    { id: "bottom", nome: "Baixo" },
    { id: "vestido", nome: "Vestidos" },
    { id: "casaco", nome: "Casacos" },
    { id: "calcado", nome: "Calçados" },
    { id: "acessorio", nome: "Acessórios" },
    { id: "joia", nome: "Joias" },
    { id: "chapeu", nome: "Chapéus" }
  ];
  // sub-filtros no estilo do Google: aparecem quando uma categoria é escolhida
  var SUBS = {
    top: ["alça", "manga curta", "manga longa"],
    bottom: ["calça", "short", "saia"],
    casaco: ["blazer", "jaqueta", "sobretudo", "cardigã", "kimono", "colete"],
    calcado: ["tênis", "bota", "sandália", "sapato", "chinelo"],
    acessorio: ["bolsa", "cinto", "óculos", "lenço"],
    joia: ["colar", "brinco", "relógio"],
    chapeu: ["boné", "gorro"],
    vestido: ["vestido", "macaquinho"]
  };
  var SLOTS = [
    { role: "top", label: "Cima", cat: "top" },
    { role: "bottom", label: "Baixo", cat: "bottom" },
    { role: "vestido", label: "Vestido", cat: "vestido" },
    { role: "casaco", label: "Casaco", cat: "casaco" },
    { role: "calcado", label: "Calçado", cat: "calcado" }
  ];
  // posições do flat-lay em % (caixa 4:5)
  var LAY = {
    vestido: { l: 27, t: 5, w: 46 }, top: { l: 5, t: 8, w: 40 }, casaco: { l: 46, t: 3, w: 51 },
    bottom: { l: 8, t: 42, w: 43 }, calcado: { l: 58, t: 58, w: 29 }
  };
  // faixa de acessórios: linha limpa embaixo, distribuída conforme a quantidade

  function promptProduto(it) {
    var p = PROMPT_PRODUTO + ". a peça é: " + it.nome;
    if (it.det) p += ". detalhes importantes, respeite exatamente: " + it.det;
    p += ". mantenha a cor e o tecido idênticos aos da foto, não clareie nem troque o material";
    return p;
  }
  function promptLook(ids) {
    var det = (ids || []).map(function (id) { return byId[id]; }).filter(Boolean)
      .map(function (i) { return i.nome + (i.det ? " (" + i.det + ")" : ""); }).join("; ");
    return PROMPT_LOOK + (det ? ". as peças são: " + det : "");
  }
  var PROMPT_PRODUTO = "foto de produto desta peça de roupa, vestida em manequim invisível, esticada sem amassados, fundo branco puro, luz de estúdio suave, vista frontal centralizada, peça inteira visível, sem pessoa, sem sombra no chão";
  var PROMPT_LOOK = "a modelo da primeira imagem vestindo exatamente as peças da segunda imagem, mesma pose de pé de frente, corpo inteiro dos pés à cabeça, mesmo rosto e mesmo cabelo, fundo branco liso, luz de estúdio suave e uniforme, foto de catálogo realista, roupas caindo naturalmente no corpo, sem alterar o rosto, sem texto";

  /* ---------------- estado ---------------- */
  var itens = window.CATALOGO.map(function (r) {
    return { id: r[0], nome: r[1], cat: r[2], sub: r[3], est: r[4], novo: !!r[5], pendente: r[5] === 1, det: r[6] || "", src: "img/" + r[0] + ".webp" };
  });
  var byId = {}; itens.forEach(function (i) { byId[i.id] = i; });
  function aplicarEdicoes() {
    Object.keys(S.del || {}).forEach(function (id) {
      var i = itens.map(function (x) { return x.id; }).indexOf(id);
      if (i >= 0) itens.splice(i, 1);
      delete byId[id];
    });
    Object.keys(S.edit || {}).forEach(function (id) {
      var it = byId[id], e = S.edit[id]; if (!it || !e) return;
      it.nome = e.nome || it.nome; it.cat = e.cat || it.cat; it.sub = e.sub || it.sub;
      it.est = e.est || it.est; it.det = e.det || "";
    });
  }

  var S = { tab: "pecas", cat: "todas", sub: "todas", est: "todas", q: "", sel: {}, acc: [], outfits: [], extra: [], fix: {}, edit: {}, del: {}, vis: {}, semOff: [], quando: 0 };
  var CFG = { prov: "puter", gkey: "", xkey: "", rosto: "", gh: "" };
  function rostoRef() { return CFG.rosto || window.AVATAR_PADRAO || ""; }

  /* ---------------- armazenamento ----------------
     Antes tudo ia pro localStorage, que estoura em ~5 MB por causa das fotos
     em base64: o save falhava calado e as edições voltavam no refresh.
     Agora: IndexedDB neste aparelho (sem limite apertado) + estado.json no
     GitHub, que é o que faz o guarda-roupa existir em qualquer navegador. */
  var REPO = { dono: "laurapcorrea", nome: "guarda-roupa", arq: "estado.json", ramo: "main" };
  var _db = null;
  function db() {
    if (_db) return _db;
    _db = new Promise(function (res, rej) {
      var r = indexedDB.open("guarda_roupa", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("kv"); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return _db;
  }
  function dbGet(k) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var q = d.transaction("kv", "readonly").objectStore("kv").get(k);
        q.onsuccess = function () { res(q.result); }; q.onerror = function () { rej(q.error); };
      });
    });
  }
  function dbSet(k, v) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var q = d.transaction("kv", "readwrite").objectStore("kv").put(v, k);
        q.onsuccess = function () { res(); }; q.onerror = function () { rej(q.error); };
      });
    });
  }

  function estadoAtual() {
    return { outfits: S.outfits, extra: S.extra, fix: S.fix, edit: S.edit,
             del: S.del, vis: S.vis, semOff: S.semOff, atualizadoEm: S.quando || 0 };
  }
  function aplicarEstado(a) {
    if (!a) return;
    S.outfits = a.outfits || []; S.extra = a.extra || []; S.fix = a.fix || {};
    S.edit = a.edit || {}; S.del = a.del || {}; S.vis = a.vis || {};
    S.semOff = a.semOff || []; S.quando = a.atualizadoEm || 0;
  }

  // lê o estado publicado, sem precisar de token
  function lerRemoto() {
    var u = "https://raw.githubusercontent.com/" + REPO.dono + "/" + REPO.nome + "/" + REPO.ramo + "/" + REPO.arq + "?t=" + Date.now();
    return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  function load() {
    try { CFG = Object.assign(CFG, JSON.parse(localStorage.getItem("gr_cfg") || "{}")); } catch (e) {}
    var antigo = null;
    try { antigo = JSON.parse(localStorage.getItem("gr_state") || "null"); } catch (e) {}
    return Promise.all([
      dbGet("estado").catch(function () { return null; }),
      lerRemoto()
    ]).then(function (r) {
      var local = r[0] || antigo, remoto = r[1];
      // o mais novo ganha; o que nunca foi sincronizado conta como 0
      var tl = (local && local.atualizadoEm) || 0, tr = (remoto && remoto.atualizadoEm) || 0;
      var esc = local && (!remoto || tl >= tr) ? local : (remoto || local);
      aplicarEstado(esc);
      if (local && !r[0]) dbSet("estado", local).catch(function () {});   // migra do localStorage
      juntarSementes();
      S.extra.forEach(function (it) { if (!byId[it.id]) { itens.push(it); byId[it.id] = it; } });
      Object.keys(S.fix).forEach(function (id) { if (byId[id]) { byId[id].src = S.fix[id]; byId[id].pendente = false; } });
    });
  }

  /* Looks que vêm no próprio site, com a foto no avatar já pronta.
     Repostos a pedido dela, porque os que ela montou se perderam.
     Não entra duplicado (compara as peças), e se ela apagar um, o id fica
     em semOff e ele não volta mais, em nenhum aparelho. */
  function juntarSementes() {
    var SD = window.LOOKS_SEED; if (!SD || !SD.length) return;
    var porId = {}, porPecas = {};
    S.outfits.forEach(function (o) {
      porId[o.id] = 1;
      porPecas[(o.itens || []).slice().sort().join(",")] = 1;
    });
    SD.forEach(function (sd) {
      if (porId[sd.id]) return;
      if (S.semOff.indexOf(sd.id) >= 0) return;
      if (porPecas[(sd.itens || []).slice().sort().join(",")]) return;
      S.outfits.push({ id: sd.id, nome: sd.nome, est: sd.est, itens: (sd.itens || []).slice(), lookUrl: "" });
    });
  }

  var _tSync = null;
  function save() {
    S.quando = Date.now();
    var e = estadoAtual();
    dbSet("estado", e).catch(function () { toast("Não consegui salvar neste aparelho."); });
    if (!CFG.gh) return;
    clearTimeout(_tSync);
    _tSync = setTimeout(function () { enviarRemoto(e); }, 1800);
  }

  function b64(txt) { return btoa(unescape(encodeURIComponent(txt))); }
  var _enviando = false, _pendente = null;
  function enviarRemoto(e) {
    if (!CFG.gh) return;
    if (_enviando) { _pendente = e; return; }   // não perde a mudança que chegou no meio do envio
    _enviando = true; marcarSync("salvando");
    tentarEnviar(e, 0);
  }
  // O GET do GitHub às vezes devolve um sha em cache logo depois de uma gravação,
  // e aí o PUT volta 409 "does not match". Relê sem cache e tenta de novo.
  function tentarEnviar(e, n) {
    var base = "https://api.github.com/repos/" + REPO.dono + "/" + REPO.nome + "/contents/" + REPO.arq;
    var h = { Authorization: "Bearer " + CFG.gh, Accept: "application/vnd.github+json" };
    fetch(base + "?ref=" + REPO.ramo + "&t=" + Date.now(), { headers: h, cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (meta) {
        return fetch(base, {
          method: "PUT", headers: h,
          body: JSON.stringify({
            message: "estado do guarda-roupa", branch: REPO.ramo,
            content: b64(JSON.stringify(e)), sha: meta && meta.sha ? meta.sha : undefined
          })
        });
      })
      .then(function (r) {
        if (r.ok) { terminouSync(true); return; }
        if ((r.status === 409 || r.status === 422) && n < 4) {
          setTimeout(function () { tentarEnviar(e, n + 1); }, 600 * (n + 1));
          return;
        }
        r.json().then(function (j) { toast("Sync falhou: " + ((j && j.message) || r.status)); }).catch(function () {});
        terminouSync(false);
      })
      .catch(function (err) { toast("Sync falhou: " + err.message); terminouSync(false); });
  }
  function terminouSync(ok) {
    _enviando = false;
    marcarSync(ok ? "ok" : "erro");
    if (_pendente) { var q = _pendente; _pendente = null; enviarRemoto(q); }
  }
  function marcarSync(e) {
    var n = document.getElementById("sync"); if (!n) return;
    n.className = "sync " + e;
    n.textContent = e === "salvando" ? "salvando…" : e === "ok" ? "salvo no GitHub" : e === "erro" ? "não salvou" : "";
    if (e === "ok") setTimeout(function () { if (n.className === "sync ok") n.textContent = ""; }, 2600);
  }
  function saveCfg() { try { localStorage.setItem("gr_cfg", JSON.stringify(CFG)); } catch (e) {} }

  /* ---------------- helpers ---------------- */
  var $ = function (s) { return document.querySelector(s); };
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function svg(d) { return '<svg viewBox="0 0 24 24">' + d + "</svg>"; }
  var IC = {
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M17.7 6.3l-2.8 2.8M9.1 14.9l-2.8 2.8"/>',
    check: '<path d="m5 13 4 4L19 7"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', down: '<path d="M12 4v12M7 12l5 5 5-5M5 20h14"/>',
    copy: '<path d="M9 9h10v10H9zM5 15V5h10"/>'
  };
  function toast(m) {
    var o = document.querySelector(".toast"); if (o) o.remove();
    var t = el("div", "toast", m); document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3600);
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /* ---------------- imagem: canvas ---------------- */
  function loadImg(src) {
    return new Promise(function (res, rej) {
      var i = new Image(); i.crossOrigin = "anonymous";
      i.onload = function () { res(i); }; i.onerror = function () { rej(new Error("img")); }; i.src = src;
    });
  }
  function shrink(file, max, q) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file);
      loadImg(url).then(function (im) {
        var s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
        var c = document.createElement("canvas");
        c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", q || 0.86));
      }).catch(rej);
    });
  }
  // tira o fundo branco (o que a IA devolve) e deixa PNG transparente, recortado
  function tirarFundoBranco(dataUrl, corte) {
    corte = corte || 238;
    return loadImg(dataUrl).then(function (im) {
      var w = im.naturalWidth, h = im.naturalHeight;
      var c = document.createElement("canvas"); c.width = w; c.height = h;
      var x = c.getContext("2d"); x.drawImage(im, 0, 0);
      var d = x.getImageData(0, 0, w, h), p = d.data;
      var minx = w, miny = h, maxx = 0, maxy = 0;
      for (var i = 0; i < p.length; i += 4) {
        var mn = Math.min(p[i], p[i + 1], p[i + 2]);
        if (mn >= corte) { p[i + 3] = 0; }
        else {
          var a = Math.min(255, Math.round((corte - mn) * 255 / 14));
          p[i + 3] = a;
          if (a > 40) {
            var px = (i / 4) % w, py = Math.floor(i / 4 / w);
            if (px < minx) minx = px; if (px > maxx) maxx = px;
            if (py < miny) miny = py; if (py > maxy) maxy = py;
          }
        }
      }
      x.putImageData(d, 0, 0);
      if (maxx <= minx || maxy <= miny) { minx = 0; miny = 0; maxx = w - 1; maxy = h - 1; }
      var pad = Math.round(Math.max(maxx - minx, maxy - miny) * 0.03);
      minx = Math.max(0, minx - pad); miny = Math.max(0, miny - pad);
      maxx = Math.min(w - 1, maxx + pad); maxy = Math.min(h - 1, maxy + pad);
      var cw = maxx - minx + 1, ch = maxy - miny + 1, M = 512, inner = M * 0.9;
      var s = inner / Math.max(cw, ch);
      var o = document.createElement("canvas"); o.width = M; o.height = M;
      var ox = o.getContext("2d");
      ox.drawImage(c, minx, miny, cw, ch, (M - cw * s) / 2, (M - ch * s) / 2, cw * s, ch * s);
      return o.toDataURL("image/webp", 0.88);
    });
  }
  // junta as peças do look numa imagem só (referência pro try-on)
  function montarFlatLay(ids) {
    var W = 800, H = 1000;
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var x = c.getContext("2d"); x.fillStyle = "#ffffff"; x.fillRect(0, 0, W, H);
    var list = ids.map(function (id) { return byId[id]; }).filter(Boolean);
    return Promise.all(list.map(function (it) { return loadImg(it.src).catch(function () { return null; }); }))
      .then(function (ims) {
        var n = ims.filter(Boolean).length, cols = n <= 4 ? 2 : 3;
        var cw = W / cols, rows = Math.ceil(n / cols), chh = H / rows, k = 0;
        ims.forEach(function (im) {
          if (!im) return;
          var col = k % cols, row = Math.floor(k / cols); k++;
          var s = Math.min(cw * 0.86 / im.naturalWidth, chh * 0.86 / im.naturalHeight);
          var w = im.naturalWidth * s, h = im.naturalHeight * s;
          x.drawImage(im, col * cw + (cw - w) / 2, row * chh + (chh - h) / 2, w, h);
        });
        return c.toDataURL("image/jpeg", 0.9);
      });
  }

  /* ---------------- IA ---------------- */
  function b64(dataUrl) { return dataUrl.split(",")[1]; }
  function mime(dataUrl) { var m = /^data:([^;]+);/.exec(dataUrl); return m ? m[1] : "image/jpeg"; }

  function geminiImagem(prompt, imgs) {
    if (!CFG.gkey) return Promise.reject(new Error("sem key do Gemini"));
    var parts = [{ text: prompt }];
    imgs.forEach(function (d) { parts.push({ inline_data: { mime_type: mime(d), data: b64(d) } }); });
    var model = CFG.gmodel || "gemini-3.1-flash-image";
    return fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent", {
      method: "POST",
      headers: { "x-goog-api-key": CFG.gkey, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: parts }] })
    }).then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (o) {
        if (o.j && o.j.candidates) {
          var ps = o.j.candidates[0].content.parts || [];
          for (var i = 0; i < ps.length; i++) {
            var d = ps[i].inlineData || ps[i].inline_data;
            if (d && d.data) return "data:" + (d.mimeType || d.mime_type || "image/png") + ";base64," + d.data;
          }
          throw new Error("o Gemini respondeu sem imagem");
        }
        var msg = (o.j && o.j.error && o.j.error.message) || ("erro " + o.s);
        if (o.s === 429) msg = "cota zerada no Gemini: ative o faturamento no projeto da key ou use o Grok";
        throw new Error(msg);
      });
  }

  function grokImagem(prompt, imgs) {
    if (!CFG.xkey) return Promise.reject(new Error("sem key do Grok"));
    var body = { model: CFG.xmodel || "grok-imagine-image-2.0", prompt: prompt, response_format: "b64_json" };
    var url = "https://api.x.ai/v1/images/generations";
    if (imgs && imgs.length) { url = "https://api.x.ai/v1/images/edits"; body.image = { url: imgs[0], type: "image_url" }; }
    return fetch(url, {
      method: "POST",
      headers: { Authorization: "Bearer " + CFG.xkey, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (o) {
        var d = o.j && o.j.data && o.j.data[0];
        if (d && (d.b64_json || d.url)) return d.b64_json ? "data:image/png;base64," + d.b64_json : d.url;
        throw new Error((o.j && o.j.error && (o.j.error.message || o.j.error)) || ("erro " + o.s));
      });
  }


  /* Puter: Nano Banana de graça, sem chave. A Laura entra na conta Puter dela
     uma vez e o uso corre pela cota gratuita dela, não pela minha. */
  function puterPronto() {
    if (window.puter && window.puter.ai && window.puter.ai.txt2img) return Promise.resolve();
    return new Promise(function (res, rej) {
      var t = 0, iv = setInterval(function () {
        if (window.puter && window.puter.ai && window.puter.ai.txt2img) { clearInterval(iv); res(); }
        else if (++t > 80) { clearInterval(iv); rej(new Error("o Puter não carregou, confira a conexão")); }
      }, 250);
    });
  }

  function juntarImgs(imgs) {
    if (!imgs || !imgs.length) return Promise.resolve(null);
    if (imgs.length === 1) return Promise.resolve(imgs[0]);
    return Promise.all(imgs.map(loadImg)).then(function (ims) {
      var H = 1024, W = 0;
      var ws = ims.map(function (im) { var w = Math.round(im.naturalWidth * H / im.naturalHeight); W += w; return w; });
      var c = document.createElement("canvas"); c.width = W; c.height = H;
      var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, W, H);
      var ox = 0;
      ims.forEach(function (im, i) { x.drawImage(im, ox, 0, ws[i], H); ox += ws[i]; });
      return c.toDataURL("image/jpeg", 0.9);
    });
  }

  function paraDataUrl(src) {
    if (!src) return Promise.reject(new Error("o Puter respondeu sem imagem"));
    if (src.indexOf("data:") === 0) return Promise.resolve(src);
    return fetch(src).then(function (r) { return r.blob(); }).then(function (b) {
      return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsDataURL(b); });
    });
  }

  function puterImagem(prompt, imgs) {
    return puterPronto().then(function () { return juntarImgs(imgs); }).then(function (one) {
      var o = { model: CFG.pmodel || "google/gemini-3.1-flash-image-preview" };
      if (one) { o.input_image = b64(one); o.input_image_mime_type = mime(one); }
      return window.puter.ai.txt2img(prompt, o);
    }).then(function (r) {
      var src = r && r.src ? r.src : (typeof r === "string" ? r : null);
      return paraDataUrl(src);
    }).catch(function (e) {
      var bruto = (e && (e.message || e.error || e.code || "")) + " " + JSON.stringify(e || {});
      var msg = String((e && (e.message || e.error || e)) || "erro no Puter");
      if (/sign|auth|login/i.test(bruto)) {
        msg = "entre na conta Puter na janelinha que abriu e tente de novo";
      } else if (/balance|funding|insufficient|upgrade|quota|credit/i.test(bruto)) {
        msg = "a franquia grátis do Puter deste mês acabou. Ela renova na virada do mês. Pra gerar agora, troque o gerador na engrenagem pra Gemini ou Grok.";
      }
      throw new Error(msg);
    });
  }

  function gerar(prompt, imgs) {
    if (CFG.prov === "grok") return grokImagem(prompt, imgs);
    if (CFG.prov === "gemini") return geminiImagem(prompt, imgs);
    return puterImagem(prompt, imgs);
  }
  function temIA() {
    if (CFG.prov === "grok") return !!CFG.xkey;
    if (CFG.prov === "gemini") return !!CFG.gkey;
    return true;
  }

  /* ---------------- filtros e grade ---------------- */
  function listaFiltrada() {
    var q = S.q.trim().toLowerCase();
    return itens.filter(function (i) {
      if (S.cat !== "todas" && i.cat !== S.cat) return false;
      if (S.sub && S.sub !== "todas" && i.sub !== S.sub) return false;
      if (q && (i.nome + " " + i.sub + " " + i.cat).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function railRender() {
    var r = $("#rail"); r.innerHTML = "";
    if (S.tab === "pecas") {
      CATS.forEach(function (c) {
        var n = c.id === "todas" ? itens.length : itens.filter(function (i) { return i.cat === c.id; }).length;
        var b = el("button", "chip"); b.innerHTML = c.nome + '<span class="n">' + n + "</span>";
        b.setAttribute("aria-pressed", String(S.cat === c.id));
        b.onclick = function () { S.cat = c.id; S.sub = "todas"; railRender(); gridRender(); };
        r.appendChild(b);
      });
      var subs = SUBS[S.cat];
      if (subs) {
        var r2 = $("#rail2"); r2.innerHTML = ""; r2.hidden = false;
        var tb = el("button", "chip sub", "Tudo");
        tb.setAttribute("aria-pressed", String(!S.sub || S.sub === "todas"));
        tb.onclick = function () { S.sub = "todas"; railRender(); gridRender(); };
        r2.appendChild(tb);
        subs.forEach(function (sb) {
          var n = itens.filter(function (i) { return i.cat === S.cat && i.sub === sb; }).length;
          if (!n) return;
          var b2 = el("button", "chip sub"); b2.innerHTML = sb + '<span class="n">' + n + "</span>";
          b2.setAttribute("aria-pressed", String(S.sub === sb));
          b2.onclick = function () { S.sub = sb; railRender(); gridRender(); };
          r2.appendChild(b2);
        });
      } else { $("#rail2").hidden = true; }
    } else {
      $("#rail2").hidden = true;
      [["todas", "Todas"], ["V", "Verão"], ["O", "Outono"], ["I", "Inverno"], ["P", "Primavera"]].forEach(function (e) {
        var b = el("button", "chip", e[1]);
        b.setAttribute("aria-pressed", String(S.est === e[0]));
        b.onclick = function () { S.est = e[0]; railRender(); looksRender(); };
        r.appendChild(b);
      });
    }
  }
  function tile(it, onClick, marcado) {
    var b = el("button", "tile" + (marcado ? " on" : ""));
    b.setAttribute("aria-label", it.nome);
    var im = el("img"); im.src = it.src; im.alt = it.nome; im.loading = "lazy"; b.appendChild(im);
    if (it.pendente) b.appendChild(el("span", "nu"));
    if (it.pendente) b.appendChild(el("span", "tag", "tratar"));
    b.appendChild(el("span", "cap", it.nome));
    b.onclick = onClick; return b;
  }
  function gridRender() {
    var g = $("#grid"); g.innerHTML = "";
    var l = listaFiltrada();
    $("#cPecas").textContent = l.length + (l.length === 1 ? " peça" : " peças");
    $("#count").textContent = itens.length + " peças";
    l.forEach(function (i) { g.appendChild(tile(i, function () { abrirPeca(i); })); });
    if (!l.length) { var e = el("div", "empty"); e.innerHTML = "<h3>Nada aqui</h3><p>Nenhuma peça bate com esse filtro.</p>"; g.appendChild(e); }
  }

  /* ---------------- modal ---------------- */
  function fechar() { $("#modalRoot").innerHTML = ""; document.body.style.overflow = ""; }
  var VOLTAR = null;
  function abrirModal(build, aoFechar) {
    var root = $("#modalRoot"); root.innerHTML = "";
    var sc = el("div", "scrim");
    sc.onclick = function () { fechar(); if (aoFechar) aoFechar(); };
    VOLTAR = aoFechar || null;
    var m = el("div", "modal"); m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true");
    root.appendChild(sc); root.appendChild(m); document.body.style.overflow = "hidden";
    build(m); m.scrollTop = 0; return m;
  }
  function cabeca(m, t, s) {
    var h = el("div", "mhead"), left = el("div");
    left.appendChild(el("h2", null, t)); if (s) left.appendChild(el("p", null, s));
    var x = el("button", "sq"); x.innerHTML = svg('<path d="M6 6l12 12M18 6 6 18"/>');
    x.onclick = function () { var v = VOLTAR; fechar(); if (v) v(); };
    h.appendChild(left); h.appendChild(x); m.appendChild(h);
  }

  /* ---------------- peça ---------------- */


  function confirmarExclusao(it) {
    abrirModal(function (m) {
      cabeca(m, "Tirar do guarda-roupa?", it.nome);
      var p = el("p", "note");
      p.textContent = "A peça some da lista e dos filtros. Os looks que já usam ela continuam salvos. Dá pra trazer de volta em Restaurar, na engrenagem.";
      m.appendChild(p);
      var r = el("div", "row"); r.style.marginTop = "16px";
      var bx = el("button", "btn solid"); bx.style.background = "var(--coral)"; bx.style.color = "#fff";
      bx.textContent = "Sim, tirar";
      bx.onclick = function () {
        S.del[it.id] = 1; save();
        var i = itens.indexOf(it); if (i >= 0) itens.splice(i, 1);
        delete byId[it.id];
        fechar(); railRender(); gridRender(); toast("Peça removida.");
      };
      r.appendChild(bx);
      var bn = el("button", "btn ghost", "Cancelar");
      bn.onclick = function () { fechar(); abrirPeca(it); };
      r.appendChild(bn);
      m.appendChild(r);
    });
  }

  function editarPeca(it) {
    abrirModal(function (m) {
      cabeca(m, "Editar peça", "o que você escrever aqui vai junto no pedido pra IA");

      var fn = el("label", "field");
      fn.innerHTML = '<span class="k">Nome</span><input id="eNome" autocomplete="off">';
      m.appendChild(fn); $("#eNome").value = it.nome;

      var fc = el("label", "field");
      fc.innerHTML = '<span class="k">Categoria</span><select id="eCat">' +
        CATS.filter(function (c) { return c.id !== "todas"; })
            .map(function (c) { return '<option value="' + c.id + '">' + c.nome + "</option>"; }).join("") + "</select>";
      m.appendChild(fc); $("#eCat").value = it.cat;

      var fs = el("label", "field");
      fs.innerHTML = '<span class="k">Tipo</span><select id="eSub"></select>';
      m.appendChild(fs);
      function subs() {
        var l = SUBS[$("#eCat").value] || [it.sub];
        $("#eSub").innerHTML = l.map(function (x) { return '<option value="' + x + '">' + x + "</option>"; }).join("");
        $("#eSub").value = l.indexOf(it.sub) >= 0 ? it.sub : l[0];
      }
      subs(); $("#eCat").onchange = subs;

      var fe = el("div", "field");
      fe.innerHTML = '<span class="k">Estações</span><div id="eEst" class="rail rail-sub"></div>';
      m.appendChild(fe);
      var atual = it.est.split("");
      [["V", "Verão"], ["O", "Outono"], ["I", "Inverno"], ["P", "Primavera"]].forEach(function (e) {
        var b = el("button", "chip sub", e[1]);
        b.setAttribute("aria-pressed", String(atual.indexOf(e[0]) >= 0));
        b.onclick = function () {
          var i = atual.indexOf(e[0]);
          if (i >= 0) atual.splice(i, 1); else atual.push(e[0]);
          b.setAttribute("aria-pressed", String(atual.indexOf(e[0]) >= 0));
        };
        $("#eEst").appendChild(b);
      });

      var fd = el("label", "field");
      fd.innerHTML = '<span class="k">Detalhes pra IA</span>' +
        '<textarea id="eDet" rows="3" placeholder="tecido de tule transparente marrom, gola alta, manga longa · ou: preta mesmo, não cinza"></textarea>';
      m.appendChild(fd); $("#eDet").value = it.det || "";

      var r = el("div", "row");
      var bs = el("button", "btn solid"); bs.innerHTML = svg(IC.check) + " Salvar";
      bs.onclick = function () {
        var e = {
          nome: $("#eNome").value.trim() || it.nome,
          cat: $("#eCat").value, sub: $("#eSub").value,
          est: (atual.join("") || it.est), det: $("#eDet").value.trim()
        };
        S.edit[it.id] = e;
        it.nome = e.nome; it.cat = e.cat; it.sub = e.sub; it.est = e.est; it.det = e.det;
        save(); fechar(); railRender(); gridRender(); toast("Peça atualizada.");
      };
      r.appendChild(bs);
      var bc = el("button", "btn ghost", "Cancelar");
      bc.onclick = function () { fechar(); abrirPeca(it); };
      r.appendChild(bc);
      m.appendChild(r);

      var p = el("p", "note"); p.style.marginTop = "14px";
      p.innerHTML = "Os detalhes entram no pedido toda vez que você mandar tratar a foto ou gerar um look. " +
        "Quanto mais específico o tecido e a cor, mais fiel a IA fica.";
      m.appendChild(p);
    });
  }

  function abrirPeca(it) {
    abrirModal(function (m) {
      cabeca(m, it.nome, it.sub + (it.pendente ? " · sem tratamento" : ""));
      var hero = el("div", "hero"); var im = el("img"); im.src = it.src; im.alt = it.nome; hero.appendChild(im); m.appendChild(hero);
      var f = el("div", "facts");
      [["Categoria", (CATS.filter(function (c) { return c.id === it.cat; })[0] || {}).nome || it.cat],
       ["Tipo", it.sub],
       ["Estações", it.est.split("").map(function (c) { return EST[c]; }).join(", ")],
       ["Foto", it.pendente ? "sem tratamento" : "recorte pronto"]]
       .concat(it.det ? [["Detalhes", it.det]] : []).forEach(function (p) {
        var d = el("div"); var k = el("span", "k", p[0]); var v = el("span", null, p[1]);
        d.appendChild(k); d.appendChild(v); f.appendChild(d);
      });
      m.appendChild(f);
      var r = el("div", "row");
      var b1 = el("button", "btn solid"); b1.innerHTML = svg(IC.check) + " Usar num look";
      b1.onclick = function () { if (it.cat === "acessorio" || it.cat === "joia" || it.cat === "chapeu") { if (S.acc.indexOf(it.id) < 0) S.acc.push(it.id); } else { S.sel[it.cat] = it.id; } fechar(); abrirMontador(); };
      r.appendChild(b1);
      var b2 = el("button", "btn"); b2.innerHTML = svg(IC.spark) + (it.pendente ? " Tratar foto" : " Refazer foto");
      b2.onclick = function () { tratarPeca(it, b2); };
      r.appendChild(b2);
      var b3 = el("button", "btn ghost", "Editar");
      b3.onclick = function () { fechar(); editarPeca(it); };
      r.appendChild(b3);
      var b4 = el("button", "btn ghost", "Excluir");
      b4.style.color = "var(--coral)";
      b4.onclick = function () { confirmarExclusao(it); };
      r.appendChild(b4);
      m.appendChild(r);
      var p = el("p", "note"); p.style.marginTop = "14px";
      p.innerHTML = temIA() ? "A IA devolve a peça em fundo branco e o site recorta sozinho." :
        "Configure a IA na engrenagem pra tratar fotos sem sair daqui.";
      m.appendChild(p);
    });
  }

  function tratarPeca(it, btn) {
    if (!temIA()) { abrirConfig(); return; }
    btn.setAttribute("disabled", ""); btn.innerHTML = svg(IC.spark) + " Gerando…";
    var bar = el("div", "bar"); bar.innerHTML = "<i></i>"; btn.parentNode.appendChild(bar);
    loadImg(it.src).then(function (im) {
      var c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
      var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0);
      return gerar(promptProduto(it), [c.toDataURL("image/jpeg", 0.92)]);
    }).then(function (out) { return tirarFundoBranco(out); })
      .then(function (webp) {
        byId[it.id].src = webp; byId[it.id].pendente = false;
        S.fix[it.id] = webp; save(); fechar(); gridRender(); toast("Foto tratada e salva.");
      }).catch(function (e) {
        bar.remove(); btn.removeAttribute("disabled"); btn.innerHTML = svg(IC.spark) + " Tentar de novo";
        toast(String(e.message || e).slice(0, 190));
      });
  }

  /* ---------------- montador ---------------- */
  function flatLay(box, sel, accs, lookUrl, modo) {
    box.innerHTML = "";
    // modo "avatar" mostra a foto gerada, "moodboard" mostra as peças soltas.
    // sem modo (montador) o comportamento antigo vale: foto quando existe.
    if (lookUrl && modo !== "moodboard") { var lk = el("img", "look"); lk.src = lookUrl; lk.alt = "look no avatar"; box.appendChild(lk); return; }
    ["bottom", "calcado", "top", "vestido", "casaco"].forEach(function (role) {
      var id = sel[role]; if (!id || !byId[id]) return;
      var p = LAY[role]; var im = el("img"); im.src = byId[id].src; im.alt = byId[id].nome;
      im.style.left = p.l + "%"; im.style.top = p.t + "%"; im.style.width = p.w + "%"; box.appendChild(im);
    });
    var lista = (accs || []).filter(function (id) { return byId[id]; }).slice(0, 6);
    if (lista.length) {
      var n = lista.length;
      var w = n <= 2 ? 20 : n <= 4 ? 17 : 14;      // peça menor conforme enche a faixa
      var gap = 3, total = n * w + (n - 1) * gap;
      var x0 = (100 - total) / 2;
      lista.forEach(function (id, k) {
        var im = el("img"); im.src = byId[id].src; im.alt = byId[id].nome;
        im.style.left = (x0 + k * (w + gap)) + "%";
        im.style.top = "78%";
        im.style.width = w + "%";
        im.style.height = "20%";
        im.style.objectFit = "contain";
        box.appendChild(im);
      });
    }
    if (!Object.keys(sel).length && !(accs || []).length) box.appendChild(el("div", "ph", "escolha as peças"));
  }

  // carregado: true quando S.sel/S.acc já refletem o que está na tela.
  // sem isso, cada redraw recarregava o look salvo e desfazia a troca que ela acabou de fazer.
  function abrirMontador(edit, carregado) {
    if (edit && !carregado) {
      S.sel = {}; S.acc = [];
      (edit.itens || []).forEach(function (id) {
        var it = byId[id]; if (!it) return;
        if (it.cat === "acessorio" || it.cat === "joia" || it.cat === "chapeu") S.acc.push(id); else S.sel[it.cat] = id;
      });
    }
    abrirModal(function (m) {
      cabeca(m, edit ? "Editar look" : "Montar look", "uma peça por caixa, quantos acessórios quiser");
      var box = el("div", "flat"); box.style.marginBottom = "16px"; m.appendChild(box);
      var sl = el("div", "slots");
      SLOTS.forEach(function (s) {
        var b = el("button", "slot"), id = S.sel[s.role];
        if (id && byId[id]) {
          b.className = "slot full";
          var im = el("img"); im.src = byId[id].src; im.alt = byId[id].nome; b.appendChild(im);
          var x = el("span", "x", "×"); x.onclick = function (ev) { ev.stopPropagation(); delete S.sel[s.role]; redraw(); };
          b.appendChild(x);
        } else { b.appendChild(el("span", "plus", "+")); }
        b.appendChild(el("span", "k", s.label));
        b.onclick = function () { escolher(s.cat, function (pid) { S.sel[s.role] = pid; redraw(); }, false, function () { abrirMontador(edit, true); }); };
        sl.appendChild(b);
      });
      m.appendChild(sl);

      var lab = el("div", "field"); lab.innerHTML = '<span class="k">Acessórios</span>'; m.appendChild(lab);
      var strip = el("div", "acc-strip");
      S.acc.forEach(function (id, k) {
        if (!byId[id]) return;
        var a = el("div", "a"); var im = el("img"); im.src = byId[id].src; im.alt = byId[id].nome; a.appendChild(im);
        var x = el("span", "x", "×"); x.onclick = function () { S.acc.splice(k, 1); redraw(); }; a.appendChild(x);
        strip.appendChild(a);
      });
      var add = el("button", "add", "+");
      add.onclick = function () { escolher("acessorio", function (pid) { if (S.acc.indexOf(pid) < 0) S.acc.push(pid); redraw(); }, true, function () { abrirMontador(edit, true); }); };
      strip.appendChild(add); m.appendChild(strip);

      var two = el("div", "two");
      var f1 = el("label", "field"); f1.innerHTML = '<span class="k">Nome</span><input id="oNome" placeholder="ex: Frio 3" autocomplete="off">';
      var f2 = el("label", "field"); f2.innerHTML = '<span class="k">Estação</span><select id="oEst"><option value="O">Outono</option><option value="I">Inverno</option><option value="V">Verão</option><option value="P">Primavera</option></select>';
      two.appendChild(f1); two.appendChild(f2); m.appendChild(two);
      if (edit) { $("#oNome").value = edit.nome || ""; $("#oEst").value = edit.est || "O"; }

      var r = el("div", "row");
      var bs = el("button", "btn solid"); bs.innerHTML = svg(IC.check) + " Salvar look";
      bs.onclick = function () { salvarLook(edit); }; r.appendChild(bs);
      var bc = el("button", "btn ghost", "Limpar"); bc.onclick = function () { S.sel = {}; S.acc = []; redraw(); }; r.appendChild(bc);
      m.appendChild(r);

      flatLay(box, S.sel, S.acc);
      function redraw() { fechar(); abrirMontador(edit, true); }
    });
  }

  // o que cada caixa aceita além da própria categoria (camisa serve de casaco, etc)
  var EXTRA_SLOT = {
    casaco: function (i) { return i.cat === "top" && i.sub === "manga longa"; },
    top: function (i) { return i.cat === "vestido"; },
    vestido: function (i) { return false; },
    bottom: function (i) { return false; },
    calcado: function (i) { return false; }
  };

  /* Chips de sub-filtro dentro do montador, iguais aos da aba Peças.
     A chave é a subcategoria quando a peça é da própria caixa, e "cat:<categoria>"
     quando ela veio de fora (vestido aparecendo em Cima, blusa de manga longa em Casacos). */
  function railSub(m, l, cat, grupos) {
    function chaveDe(i) { return grupos.indexOf(i.cat) >= 0 ? (i.sub || "outros") : "cat:" + i.cat; }
    var ordem = (SUBS[cat] || []).slice();
    var chaves = [], visto = {};
    l.forEach(function (i) { var k = chaveDe(i); if (!visto[k]) { visto[k] = 1; chaves.push(k); } });
    chaves.sort(function (a, b) {
      var ia = ordem.indexOf(a), ib = ordem.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    if (chaves.length < 2) return function () {};
    // peças que vieram de outra categoria pra ajudar (blusa de manga longa em Casacos, vestido em Cima)
    var DE_FORA = { top: "Blusas", vestido: "Vestidos", casaco: "Casacos", bottom: "Baixo" };
    function rotulo(k) {
      if (k.indexOf("cat:") === 0) {
        var id = k.slice(4);
        if (DE_FORA[id]) return DE_FORA[id];
        var c = CATS.filter(function (x) { return x.id === id; })[0];
        return c ? c.nome : id;
      }
      return k.charAt(0).toUpperCase() + k.slice(1);
    }
    var fr = el("div", "rail rail-sub"); fr.style.marginBottom = "10px";
    var atual = { v: "todas" };
    function pinta() {
      [].slice.call(fr.children).forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.k === atual.v)); });
      [].slice.call(m.querySelectorAll(".grid > *")).forEach(function (n, k) {
        n.style.display = (atual.v === "todas" || chaveDe(l[k]) === atual.v) ? "" : "none";
      });
    }
    [["todas", "Tudo"]].concat(chaves.map(function (k) { return [k, rotulo(k)]; })).forEach(function (e) {
      var n = e[0] === "todas" ? l.length : l.filter(function (i) { return chaveDe(i) === e[0]; }).length;
      if (!n) return;
      var b = el("button", "chip sub"); b.innerHTML = e[1] + '<span class="n">' + n + "</span>";
      b.dataset.k = e[0];
      b.onclick = function () { atual.v = e[0]; pinta(); };
      fr.appendChild(b);
    });
    m.appendChild(fr);
    return pinta;
  }

  function escolher(cat, cb, multi, voltar) {
    var grupos = cat === "acessorio" ? ["acessorio", "joia", "chapeu"] : [cat];
    var base = itens.filter(function (i) { return grupos.indexOf(i.cat) >= 0; });
    var extraFn = EXTRA_SLOT[cat];
    var extra = extraFn ? itens.filter(function (i) { return grupos.indexOf(i.cat) < 0 && extraFn(i); }) : [];
    var l = base.concat(extra);
    abrirModal(function (m) {
      cabeca(m, cat === "acessorio" ? "Acessórios, joias e chapéus" : ((CATS.filter(function (c) { return c.id === cat; })[0] || {}).nome || cat), l.length + " opções" + (multi ? " · pode escolher vários" : ""));
      if (!multi) {
        var rv = el("div", "row"); rv.style.margin = "0 0 12px";
        var bv = el("button", "btn ghost sm", "Voltar sem escolher");
        bv.onclick = function () { fechar(); if (voltar) voltar(); };
        rv.appendChild(bv);
        var bt = el("button", "btn ghost sm", "Ver todas as peças");
        bt.onclick = function () { l = itens.slice(); fechar(); escolherTudo(cat, cb, voltar); };
        rv.appendChild(bt);
        m.appendChild(rv);
      }
      var pinta = railSub(m, l, cat, grupos);
      var g = el("div", "grid");
      l.forEach(function (i) {
        g.appendChild(tile(i, function () {
          cb(i.id);
          if (!multi) return;
        }, multi && S.acc.indexOf(i.id) >= 0));
      });
      m.appendChild(g);
      pinta();
      if (multi) {
        var r = el("div", "row"); r.style.marginTop = "16px";
        var b = el("button", "btn mint"); b.innerHTML = svg(IC.check) + " Pronto";
        b.onclick = function () { fechar(); if (voltar) voltar(); else abrirMontador(null, true); }; r.appendChild(b); m.appendChild(r);
      }
    }, voltar);
  }

  // lista o guarda-roupa inteiro, pra quando a peça certa mora em outra categoria
  function escolherTudo(cat, cb, voltar) {
    abrirModal(function (m) {
      cabeca(m, "Todas as peças", itens.length + " opções · escolha qualquer uma pra essa caixa");
      var rv = el("div", "row"); rv.style.margin = "0 0 12px";
      var bv = el("button", "btn ghost sm", "Voltar");
      bv.onclick = function () { fechar(); escolher(cat, cb, false, voltar); };
      rv.appendChild(bv); m.appendChild(rv);
      var todos = itens.slice();
      var pinta = railSub(m, todos, null, []);
      var g = el("div", "grid");
      todos.forEach(function (i) { g.appendChild(tile(i, function () { cb(i.id); })); });
      m.appendChild(g);
      pinta();
    }, voltar);
  }

  function salvarLook(edit) {
    var nome = ($("#oNome") || {}).value || "", est = ($("#oEst") || {}).value || "O";
    var ids = Object.keys(S.sel).map(function (k) { return S.sel[k]; }).concat(S.acc);
    if (!ids.length) { toast("Escolha pelo menos uma peça"); return; }
    var o = {
      id: edit ? edit.id : uid(), nome: (nome.trim() || EST[est] + " " + (S.outfits.length + 1)),
      est: est, itens: ids, criadoEm: new Date().toISOString(),
      // se as peças mudaram, a imagem gerada antes não vale mais
      lookUrl: (edit && (edit.itens || []).slice().sort().join(",") === ids.slice().sort().join(",")) ? (edit.lookUrl || "") : ""
    };
    var i = -1; S.outfits.forEach(function (x, k) { if (x.id === o.id) i = k; });
    if (i >= 0) S.outfits[i] = o; else S.outfits.unshift(o);
    save(); S.sel = {}; S.acc = []; fechar(); irPara("looks"); toast(edit ? "Look atualizado" : "Look salvo em " + EST[est]);
  }

  /* ---------------- outfits ---------------- */
  function looksRender() {
    var w = $("#looksWrap"); w.innerHTML = "";
    var l = S.outfits.filter(function (o) { return S.est === "todas" || o.est === S.est; });
    $("#cLooks").textContent = l.length + (l.length === 1 ? " look" : " looks");
    $("#fila").textContent = temIA() ? "" : "IA não configurada";
    if (!l.length) {
      var e = el("div", "empty");
      e.innerHTML = "<h3>" + (S.est === "todas" ? "Nenhum look ainda" : "Nada nessa estação") +
        "</h3><p>Monte um look e ele fica salvo aqui, separado por estação, pra você não precisar provar tudo de novo.</p>";
      w.appendChild(e); return;
    }
    var g = el("div", "ogrid");
    l.forEach(function (o) { g.appendChild(cardLook(o)); });
    w.appendChild(g);
  }
  // procura um look já gerado: primeiro chave exata, depois o mais parecido (>=75% em comum)
  function fotoDoLook(o) {
    if (o.lookUrl) return o.lookUrl;
    var P = window.LOOKS_PRONTOS; if (!P) return "";
    var meus = (o.itens || []).slice().sort();
    var exato = P[meus.join(",")]; if (exato) return exato;
    var melhor = "", nota = 0;
    Object.keys(P).forEach(function (k) {
      var deles = k.split(",");
      var comum = 0;
      deles.forEach(function (id) { if (meus.indexOf(id) >= 0) comum++; });
      var n = comum / Math.max(deles.length, meus.length);
      if (n > nota) { nota = n; melhor = P[k]; }
    });
    return nota >= 0.75 ? melhor : "";
  }
  function cardLook(o) {
    var c = el("div", "ocard");
    var box = el("div", "flat");
    var sel = {}, accs = [];
    (o.itens || []).forEach(function (id) { var it = byId[id]; if (!it) return; if (it.cat === "acessorio" || it.cat === "joia" || it.cat === "chapeu") accs.push(id); else sel[it.cat] = id; });
    var foto = fotoDoLook(o);
    var modo = S.vis[o.id] || (foto ? "avatar" : "moodboard");
    if (!foto) modo = "moodboard";

    flatLay(box, sel, accs, foto, modo);

    // alternador moodboard / avatar, em cima da imagem
    var sw = el("div", "vswitch");
    [["moodboard", "Moodboard"], ["avatar", "Avatar"]].forEach(function (par) {
      var b = el("button", "vsw" + (modo === par[0] ? " on" : ""), par[1]);
      b.type = "button";
      b.onclick = function (ev) {
        ev.stopPropagation();
        if (par[0] === "avatar" && !foto) { toast("Esse look ainda não tem foto no avatar. Toque em Gerar eu usando."); return; }
        S.vis[o.id] = par[0]; save(); looksRender();
      };
      sw.appendChild(b);
    });
    box.appendChild(sw);
    c.appendChild(box);

    var b = el("div", "obody");
    b.appendChild(el("h3", null, o.nome));
    var tg = el("div", "tags");
    tg.appendChild(el("span", "tg mint", EST[o.est] || "—"));
    tg.appendChild(el("span", "tg", (o.itens || []).length + " peças"));
    if (foto) tg.appendChild(el("span", "tg tang", "com avatar"));
    b.appendChild(tg);
    var r = el("div", "row");
    var b1 = el("button", "btn sm solid"); b1.innerHTML = svg(IC.spark) + (o.lookUrl ? " Refazer" : " Gerar eu usando");
    b1.onclick = function () { gerarLook(o, b1); }; r.appendChild(b1);
    var b2 = el("button", "btn sm ghost", "Editar"); b2.onclick = function () { abrirMontador(o); }; r.appendChild(b2);
    var b4 = el("button", "btn sm ghost"); b4.innerHTML = svg(IC.copy || IC.spark); b4.setAttribute("aria-label", "Copiar pedido");
    b4.title = "Copiar pedido pra eu gerar manualmente";
    b4.onclick = function () { copiarPedido(o); };
    r.appendChild(b4);
    var b3 = el("button", "btn sm ghost"); b3.innerHTML = svg(IC.trash); b3.setAttribute("aria-label", "Apagar");
    b3.onclick = function () {
      S.outfits = S.outfits.filter(function (x) { return x.id !== o.id; });
      delete S.vis[o.id];
      if (o.id.indexOf("seed_") === 0 && S.semOff.indexOf(o.id) < 0) S.semOff.push(o.id);
      save(); looksRender(); toast("Look apagado");
    };
    r.appendChild(b3); b.appendChild(r); c.appendChild(b);
    return c;
  }

  // modo manual: copia o pedido do look pra ela colar pra mim quando a IA estiver sem crédito
  function copiarPedido(o) {
    var linhas = (o.itens || []).map(function (id) {
      var it = byId[id]; if (!it) return "- " + id;
      return "- " + it.nome + " (" + id + ")" + (it.det ? " :: " + it.det : "");
    });
    var txt = "GERAR LOOK NO AVATAR\nnome: " + o.nome + "\nestacao: " + (EST[o.est] || o.est) +
      "\nchave: " + (o.itens || []).slice().sort().join(",") + "\npecas:\n" + linhas.join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { toast("Pedido copiado. Cola pro Claude gerar."); },
        function () { promptFallback(txt); });
    } else promptFallback(txt);
  }
  function promptFallback(txt) {
    abrirModal(function (m) {
      cabeca(m, "Pedido do look", "copie esse texto e mande pro Claude");
      var f = el("label", "field");
      var ta = el("textarea"); ta.rows = 10; ta.value = txt; ta.style.width = "100%";
      f.appendChild(ta); m.appendChild(f);
      ta.focus(); ta.select();
    });
  }

  function gerarLook(o, btn) {
    if (!temIA()) { abrirConfig(); return; }
    
    btn.setAttribute("disabled", ""); btn.innerHTML = svg(IC.spark) + " Gerando…";
    montarFlatLay(o.itens).then(function (lay) {
      var imgs = CFG.prov === "grok" ? [lay] : [rostoRef(), lay];
      return gerar(promptLook(o.itens), imgs);
    }).then(function (out) {
      return loadImg(out).then(function (im) {
        var M = 900, s = Math.min(M / im.naturalWidth, M / im.naturalHeight);
        var c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        return c.toDataURL("image/jpeg", 0.82);
      });
    }).then(function (jpg) {
      o.lookUrl = jpg; S.vis[o.id] = "avatar"; save(); looksRender(); toast("Look gerado.");
    }).catch(function (e) {
      btn.removeAttribute("disabled"); btn.innerHTML = svg(IC.spark) + " Tentar de novo";
      toast(String(e.message || e).slice(0, 190));
    });
  }

  /* ---------------- adicionar peça ---------------- */
  $("#btnAdd").onclick = function () { $("#filePick").click(); };
  $("#filePick").onchange = function (ev) {
    var f = ev.target.files && ev.target.files[0]; ev.target.value = "";
    if (!f) return;
    shrink(f, 1200, 0.88).then(function (foto) {
      abrirModal(function (m) {
        cabeca(m, "Nova peça", temIA() ? "a IA transforma em foto de loja" : "sem IA configurada, entra como está");
        var hero = el("div", "hero"); var im = el("img"); im.src = foto; im.alt = "foto enviada"; hero.appendChild(im); m.appendChild(hero);
        var f1 = el("label", "field"); f1.innerHTML = '<span class="k">Nome</span><input id="nNome" placeholder="ex: Jaqueta de couro marrom" autocomplete="off">';
        m.appendChild(f1);
        var two = el("div", "two");
        var f2 = el("label", "field"); f2.innerHTML = '<span class="k">Categoria</span><select id="nCat">' +
          CATS.filter(function (c) { return c.id !== "todas"; }).map(function (c) { return '<option value="' + c.id + '">' + c.nome + "</option>"; }).join("") + "</select>";
        var f3 = el("label", "field"); f3.innerHTML = '<span class="k">Estações</span><select id="nEst">' +
          '<option value="OI">Outono e inverno</option><option value="VP">Verão e primavera</option>' +
          '<option value="VOIP">O ano todo</option><option value="OIP">Meia estação</option></select>';
        two.appendChild(f2); two.appendChild(f3); m.appendChild(two);
        var r = el("div", "row");
        var b = el("button", "btn solid"); b.innerHTML = svg(IC.check) + " Adicionar";
        b.onclick = function () { addPeca(foto, b); }; r.appendChild(b);
        m.appendChild(r);
      });
    }).catch(function () { toast("Não consegui ler essa foto."); });
  };

  function addPeca(foto, btn) {
    var nome = ($("#nNome") || {}).value.trim(), cat = ($("#nCat") || {}).value || "top", est = ($("#nEst") || {}).value || "OI";
    if (!nome) { toast("Dê um nome pra peça"); return; }
    var id = "u_" + uid();
    function inserir(src, pendente) {
      var it = { id: id, nome: nome, cat: cat, sub: "nova", est: est, novo: true, pendente: !!pendente, src: src };
      itens.push(it); byId[id] = it; S.extra.push(it); save();
      fechar(); railRender(); gridRender(); toast(pendente ? "Peça adicionada, sem tratamento." : "Peça adicionada e tratada.");
    }
    if (!temIA()) { inserir(foto, true); return; }
    btn.setAttribute("disabled", ""); btn.innerHTML = svg(IC.spark) + " Tratando…";
    var bar = el("div", "bar"); bar.innerHTML = "<i></i>"; btn.parentNode.appendChild(bar);
    gerar(PROMPT_PRODUTO, [foto]).then(function (out) { return tirarFundoBranco(out); })
      .then(function (webp) { inserir(webp, false); })
      .catch(function (e) { toast(String(e.message || e).slice(0, 120) + " — entrou sem tratamento."); inserir(foto, true); });
  }

  /* ---------------- config ---------------- */
  function abrirConfig() {
    abrirModal(function (m) {
      cabeca(m, "IA e backup", "as chaves ficam só neste aparelho");
      var f0 = el("label", "field"); f0.innerHTML = '<span class="k">Gerador</span><select id="cProv">' +
        '<option value="puter">Puter · Nano Banana (grátis)</option><option value="gemini">Google Gemini</option><option value="grok">Grok (xAI)</option></select>';
      m.appendChild(f0);
      var f1 = el("label", "field"); f1.innerHTML = '<span class="k">Key do Gemini</span><input id="cG" placeholder="AQ..." autocomplete="off">';
      m.appendChild(f1);
      var f2 = el("label", "field"); f2.innerHTML = '<span class="k">Key do Grok (console.x.ai)</span><input id="cX" placeholder="xai-..." autocomplete="off">';
      m.appendChild(f2);
      $("#cProv").value = CFG.prov; $("#cG").value = CFG.gkey || ""; $("#cX").value = CFG.xkey || "";

      var fs = el("label", "field");
      fs.innerHTML = '<span class="k">Token do GitHub · sincroniza os looks entre aparelhos</span>' +
        '<input id="cGH" type="password" placeholder="github_pat_..." autocomplete="off">' +
        '<span class="dica">Fine-grained, só o repositório guarda-roupa, permissão Contents: read and write. ' +
        'Sem ele os looks ficam só neste navegador.</span>';
      m.appendChild(fs);
      $("#cGH").value = CFG.gh || "";
      var lsync = el("div", "field");
      lsync.innerHTML = '<span class="dica" id="estSync">' +
        (CFG.gh ? "sincronizando com o GitHub" : "sem sincronização: os looks somem se você resetar o navegador") + '</span>';
      m.appendChild(lsync);

      var lab = el("div", "field"); lab.innerHTML = '<span class="k">Avatar usado para vestir os looks</span>'; m.appendChild(lab);
      var prev = el("div"); prev.style.cssText = "display:flex;gap:10px;align-items:center;margin-bottom:14px";
      var im = el("img"); im.src = rostoRef(); im.style.cssText = "width:78px;height:98px;object-fit:cover"; prev.appendChild(im);
      var up = el("button", "btn sm"); up.innerHTML = svg(IC.plus) + (CFG.rosto ? " Trocar" : " Trocar o avatar padrão");
      var fi = el("input"); fi.type = "file"; fi.accept = "image/*"; fi.style.display = "none";
      up.onclick = function () { fi.click(); };
      fi.onchange = function (e) {
        var f = e.target.files && e.target.files[0]; if (!f) return;
        shrink(f, 900, 0.86).then(function (d) { CFG.rosto = d; saveCfg(); fechar(); abrirConfig(); toast("Foto de referência salva."); });
      };
      prev.appendChild(up); prev.appendChild(fi); m.appendChild(prev);

      var r = el("div", "row");
      var bs = el("button", "btn solid"); bs.innerHTML = svg(IC.check) + " Salvar";
      bs.onclick = function () {
        CFG.prov = $("#cProv").value; CFG.gkey = $("#cG").value.trim(); CFG.xkey = $("#cX").value.trim();
        var antes = CFG.gh; CFG.gh = $("#cGH").value.trim();
        saveCfg(); fechar(); looksRender();
        if (CFG.gh && CFG.gh !== antes) { S.quando = Date.now(); enviarRemoto(estadoAtual()); toast("Sincronização ligada. Mandando pro GitHub…"); }
        else toast("Configuração salva.");
      };
      r.appendChild(bs);
      var be = el("button", "btn ghost"); be.innerHTML = svg(IC.down) + " Backup";
      be.onclick = function () {
        var blob = new Blob([JSON.stringify({ outfits: S.outfits, extra: S.extra, fix: S.fix, edit: S.edit, del: S.del, vis: S.vis, semOff: S.semOff }, null, 1)], { type: "application/json" });
        var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
        a.download = "guarda-roupa-backup.json"; a.click();
      };
      r.appendChild(be);
      var bp = el("button", "btn ghost", "Puxar do GitHub");
      bp.onclick = function () {
        lerRemoto().then(function (d) {
          if (!d) { toast("Não achei estado.json no repositório ainda."); return; }
          aplicarEstado(d); save(); fechar();
          aplicarEdicoes(); railRender(); gridRender(); looksRender();
          toast("Estado do GitHub carregado.");
        });
      };
      r.appendChild(bp);
      var bi = el("button", "btn ghost", "Restaurar");
      var fj = el("input"); fj.type = "file"; fj.accept = "application/json"; fj.style.display = "none";
      bi.onclick = function () { fj.click(); };
      fj.onchange = function (e) {
        var f = e.target.files && e.target.files[0]; if (!f) return;
        f.text().then(function (t) {
          var d = JSON.parse(t);
          S.outfits = d.outfits || []; S.extra = d.extra || []; S.fix = d.fix || {}; S.edit = d.edit || {}; S.del = d.del || {}; S.vis = d.vis || {}; S.semOff = d.semOff || [];
          save(); location.reload();
        }).catch(function () { toast("Arquivo inválido"); });
      };
      r.appendChild(bi); r.appendChild(fj);
      m.appendChild(r);

      var p = el("p", "note"); p.style.marginTop = "16px";
      p.innerHTML = "<b>Puter:</b> grátis e sem chave, com franquia mensal que renova na virada do mês. Se aparecer <i>Low Balance</i>, a franquia do mês acabou: espere virar o mês ou troque o gerador aqui. " +
        "<b>Gemini:</b> precisa de faturamento ativo no projeto da key (uns US$ 0,04 por foto). " +
        "<b>Grok:</b> key de API do console.x.ai, cobrada por imagem. Os looks e as peças ficam salvos neste navegador, use o backup pra levar pra outro aparelho.";
      m.appendChild(p);
    });
  }
  $("#btnCfg").onclick = abrirConfig;

  /* ---------------- navegação ---------------- */
  function irPara(t) {
    S.tab = t;
    $("#tabPecas").setAttribute("aria-selected", String(t === "pecas"));
    $("#tabLooks").setAttribute("aria-selected", String(t === "looks"));
    $("#viewPecas").hidden = t !== "pecas"; $("#viewLooks").hidden = t !== "looks";
    railRender(); if (t === "pecas") gridRender(); else looksRender();
    try { localStorage.setItem("gr_tab", t); } catch (e) {}
  }
  $("#tabPecas").onclick = function () { irPara("pecas"); };
  $("#tabLooks").onclick = function () { irPara("looks"); };
  $("#btnMontar").onclick = function () { S.sel = {}; S.acc = []; abrirMontador(); };
  $("#q").oninput = function (e) { S.q = e.target.value; gridRender(); };
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") fechar(); });

  /* ---------------- boot ---------------- */
  load().then(function () {
    aplicarEdicoes(); railRender(); gridRender(); looksRender();
    try { if (localStorage.getItem("gr_tab") === "looks") irPara("looks"); } catch (e) {}
  });
})();
