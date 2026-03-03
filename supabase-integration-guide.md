# Industrial Library × Supabase 对接方案

## 架构概览

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   前端 (HTML/JS)  │────▶│   Supabase Auth   │────▶│  Supabase DB     │
│   industrial-     │     │   邮箱/社交登录    │     │  PostgreSQL      │
│   library.html    │◀────│   JWT Token       │◀────│  RLS 行级安全    │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                                          │
                                                   ┌──────┴──────┐
                                                   │  Storage    │
                                                   │  封面图片    │
                                                   └─────────────┘
```

---

## 一、Supabase 项目配置

### 1.1 创建项目

前往 https://supabase.com，新建项目后记录：

- **Project URL**: `https://jhrepprxldlbvtsvdulk.supabase.co`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpocmVwcHJ4bGRsYnZ0c3ZkdWxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTc2MDIsImV4cCI6MjA4ODEzMzYwMn0.DWX9ZOfyg5pidOYbrxLTKd5ueTfRWr3wccBVnqPrFLc`（公开密钥，安全地嵌入前端）

### 1.2 数据库表设计

在 SQL Editor 中执行：

```sql
-- 书架表
CREATE TABLE shelves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 层表
CREATE TABLE layers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shelf_id UUID REFERENCES shelves(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- 书籍表
CREATE TABLE books (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  layer_id UUID REFERENCES layers(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  author TEXT DEFAULT '',
  nationality TEXT DEFAULT '',
  publisher TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  notes TEXT DEFAULT '',
  rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  cover_type TEXT DEFAULT 'color' CHECK (cover_type IN ('color','image')),
  cover_color TEXT DEFAULT '#C8956C',
  cover_image_url TEXT DEFAULT '',
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread','reading','read')),
  date_added DATE DEFAULT CURRENT_DATE,
  date_finished DATE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_modified() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER books_updated BEFORE UPDATE ON books
  FOR EACH ROW EXECUTE FUNCTION update_modified();

-- 索引
CREATE INDEX idx_shelves_user ON shelves(user_id);
CREATE INDEX idx_layers_shelf ON layers(shelf_id);
CREATE INDEX idx_books_layer ON books(layer_id);
CREATE INDEX idx_books_status ON books(status);
CREATE INDEX idx_books_tags ON books USING GIN(tags);
```

### 1.3 行级安全策略 (RLS)

```sql
ALTER TABLE shelves ENABLE ROW LEVEL SECURITY;
ALTER TABLE layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户管理自己的书架" ON shelves FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户管理自己的层" ON layers FOR ALL
  USING (shelf_id IN (SELECT id FROM shelves WHERE user_id = auth.uid()))
  WITH CHECK (shelf_id IN (SELECT id FROM shelves WHERE user_id = auth.uid()));

CREATE POLICY "用户管理自己的书" ON books FOR ALL
  USING (layer_id IN (
    SELECT l.id FROM layers l JOIN shelves s ON l.shelf_id = s.id
    WHERE s.user_id = auth.uid()
  ))
  WITH CHECK (layer_id IN (
    SELECT l.id FROM layers l JOIN shelves s ON l.shelf_id = s.id
    WHERE s.user_id = auth.uid()
  ));
```

### 1.4 封面图片存储

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true);

CREATE POLICY "用户上传封面" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "封面公开读取" ON storage.objects FOR SELECT
  USING (bucket_id = 'covers');
```

---

## 二、前端集成代码

### 2.1 引入 SDK

在 `<head>` 中添加：

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

### 2.2 初始化 — 添加到 app.js 顶部

```javascript
const SUPABASE_URL = 'https://你的项目.supabase.co';
const SUPABASE_ANON_KEY = '你的anon_key';
const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

supa.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user || null;
  updateAuthUI();
  if (currentUser) loadFromCloud();
});
```

### 2.3 认证模块

```javascript
async function signIn(email, pass) {
  const { error } = await supa.auth.signInWithPassword({ email, password: pass });
  if (error) return toast('登录失败: ' + error.message);
  toast('欢迎回来');
}

async function signUp(email, pass) {
  const { error } = await supa.auth.signUp({ email, password: pass });
  if (error) return toast('注册失败: ' + error.message);
  toast('注册成功，请查收验证邮件');
}

async function oauthLogin(provider) {
  await supa.auth.signInWithOAuth({ provider }); // 'google' | 'github'
}

async function signOut() {
  await supa.auth.signOut();
  currentUser = null; lib = { shelves: [] };
  render(); updateAuthUI(); toast('已退出');
}

function showAuthModal() {
  $('mTtl').textContent = '登录 Industrial Library';
  $('mBdy').innerHTML = `
    <div class="form-group"><label class="form-label">邮箱</label>
    <input class="form-input" id="aEm" type="email" placeholder="your@email.com"></div>
    <div class="form-group"><label class="form-label">密码</label>
    <input class="form-input" id="aPw" type="password" placeholder="至少6位"></div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn btn-primary" style="flex:1" onclick="signIn($('aEm').value,$('aPw').value);closeModal()">登录</button>
      <button class="btn btn-secondary" style="flex:1" onclick="signUp($('aEm').value,$('aPw').value);closeModal()">注册</button>
    </div>
    <div style="text-align:center;margin-top:14px;padding-top:14px;border-top:1px solid var(--bl)">
      <div style="font-size:11px;color:var(--dm);margin-bottom:8px">第三方登录</div>
      <button class="btn btn-ghost" onclick="oauthLogin('google')">Google</button>
      <button class="btn btn-ghost" onclick="oauthLogin('github')">GitHub</button>
    </div>`;
  $('mFtr').innerHTML = '';
  openModal();
}
```

### 2.4 云端同步

```javascript
async function loadFromCloud() {
  if (!currentUser) return;
  try {
    const { data: shelves } = await supa.from('shelves').select('*').order('sort_order');
    const sids = shelves.map(s => s.id);
    const { data: layers } = await supa.from('layers').select('*').in('shelf_id', sids).order('sort_order');
    const lids = layers.map(l => l.id);
    const { data: books } = await supa.from('books').select('*').in('layer_id', lids).order('sort_order');

    lib.shelves = shelves.map(s => ({
      id: s.id, name: s.name, expanded: false,
      layers: layers.filter(l => l.shelf_id === s.id).map(l => ({
        id: l.id, name: l.name,
        books: books.filter(b => b.layer_id === l.id).map(b => ({
          id:b.id, title:b.title, author:b.author, nationality:b.nationality,
          publisher:b.publisher, tags:b.tags||[], notes:b.notes, rating:b.rating,
          coverType:b.cover_type, coverColor:b.cover_color, coverImage:b.cover_image_url,
          status:b.status, dateAdded:b.date_added, dateFinished:b.date_finished
        }))
      }))
    }));
    lib.shelves.forEach(s => { if(!s.layers.length) s.layers.push({id:uid(),name:'第一层',books:[]}) });
    render(); toast('已从云端同步');
  } catch(e) { console.error(e); load(); render(); toast('云端失败，使用本地'); }
}

async function saveToCloud() {
  if (!currentUser) { localStorage.setItem('il-data',JSON.stringify(lib)); toast('已保存本地'); return; }
  try {
    await supa.from('shelves').delete().eq('user_id', currentUser.id);
    const sr = lib.shelves.map((s,i) => ({id:s.id, user_id:currentUser.id, name:s.name, sort_order:i}));
    if(sr.length) { const {error}=await supa.from('shelves').insert(sr); if(error)throw error; }
    const lr = [];
    lib.shelves.forEach(s => s.layers.forEach((l,i) => lr.push({id:l.id,shelf_id:s.id,name:l.name,sort_order:i})));
    if(lr.length) { const {error}=await supa.from('layers').insert(lr); if(error)throw error; }
    const br = [];
    lib.shelves.forEach(s => s.layers.forEach(l => l.books.forEach((b,i) => br.push({
      id:b.id, layer_id:l.id, title:b.title, author:b.author||'', nationality:b.nationality||'',
      publisher:b.publisher||'', tags:b.tags||[], notes:b.notes||'', rating:b.rating||0,
      cover_type:b.coverType||'color', cover_color:b.coverColor||'#C8956C',
      cover_image_url:b.coverImage||'', status:b.status||'unread',
      date_added:b.dateAdded, date_finished:b.dateFinished||null, sort_order:i
    }))));
    for(let i=0;i<br.length;i+=500){
      const {error}=await supa.from('books').insert(br.slice(i,i+500));if(error)throw error;
    }
    localStorage.setItem('il-data',JSON.stringify(lib));
    toast('已同步到云端');
  } catch(e) { console.error(e); localStorage.setItem('il-data',JSON.stringify(lib)); toast('云端失败，已存本地'); }
}

// 替换原有 save 函数
async function save() { await saveToCloud(); }
```

### 2.5 封面图片上传到 Storage

```javascript
async function uploadCover(file) {
  if (!currentUser) {
    return new Promise(r => { const fr=new FileReader(); fr.onload=e=>r(e.target.result); fr.readAsDataURL(file); });
  }
  const ext = file.name.split('.').pop();
  const path = currentUser.id + '/' + uid() + '.' + ext;
  const { error } = await supa.storage.from('covers').upload(path, file, {cacheControl:'31536000'});
  if (error) throw error;
  return supa.storage.from('covers').getPublicUrl(path).data.publicUrl;
}
```

---

## 三、改动汇总

只需对现有代码做以下修改：

1. HTML `<head>` 中加一行 Supabase SDK 引入
2. 导航栏加 `<div id="authArea"></div>`
3. `app.js` 顶部加入 Supabase 初始化代码
4. 将原 `save()` 替换为 `saveToCloud()`
5. 将原 `load(); render();` 替换为 `initApp()`
6. 封面上传改用 `uploadCover()` 获取 URL 而非 base64

其余所有书架、层、书籍、搜索、统计代码完全不变。

---

## 四、部署清单

| 步骤 | 操作 | 耗时 |
|------|------|------|
| 1 | 注册 Supabase 免费账号 | 2分钟 |
| 2 | 创建项目，执行建表 SQL | 5分钟 |
| 3 | 执行 RLS 策略 SQL | 2分钟 |
| 4 | 创建 Storage Bucket | 1分钟 |
| 5 | Authentication 中启用邮箱登录 | 1分钟 |
| 6 | （可选）启用 Google/GitHub OAuth | 5分钟 |
| 7 | 将 URL 和 Key 填入前端代码 | 1分钟 |
| 8 | 部署到 Vercel / Netlify / GitHub Pages | 5分钟 |

Supabase 免费套餐：500MB 数据库 + 1GB 存储 + 50000 月活，足够个人使用。
