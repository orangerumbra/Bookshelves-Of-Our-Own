//
const SUPABASE_URL = 'https://jhrepprxldlbvtsvdulk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpocmVwcHJ4bGRsYnZ0c3ZkdWxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTc2MDIsImV4cCI6MjA4ODEzMzYwMn0.DWX9ZOfyg5pidOYbrxLTKd5ueTfRWr3wccBVnqPrFLc';
const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

// 监听登录状态变化
supa.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user || null;
  updateAuthUI();
  if (currentUser) loadFromCloud();
});

let _cfmR=null;
function cfm(msg){return new Promise(r=>{_cfmR=r;$('cfmMsg').textContent=msg;$('cfmOvl').classList.add('open')})}
function cfmY(){$('cfmOvl').classList.remove('open');if(_cfmR)_cfmR(true);_cfmR=null}
function cfmN(){$('cfmOvl').classList.remove('open');if(_cfmR)_cfmR(false);_cfmR=null}
// ─── STATE ───
let lib={shelves:[]},curBid=null,curSid=null,curLid=null,dragD=null,searchRes=null;
const COLORS=['#C8956C','#A07850','#8B6B4A','#6B4E37','#4A3728','#BF4040','#D4785A','#D4A85A','#8AAD5A','#5A8A7A','#5A7AAD','#6B5AAD','#AD5A8A','#3D3F44','#6B6E76','#E8E0D4','#2B2D31','#1A1B1E','#D4C4A8','#8B7355'];
const SM={unread:'未读',reading:'在读',read:'已读'};
const $=id=>document.getElementById(id);
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function esc(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML}
function stars(n){return '★'.repeat(n)+'☆'.repeat(5-n)}
function isLight(h){if(!h)return false;h=h.replace('#','');if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];const r=parseInt(h.substr(0,2),16),g=parseInt(h.substr(2,2),16),b=parseInt(h.substr(4,2),16);return(r*299+g*587+b*114)/1000>150}
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent='✓ '+m;$('tBox').appendChild(t);setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(()=>t.remove(),300)},2500)}
async function save() { await saveToCloud(); }
function load(){try{const d=localStorage.getItem('il-data');if(d)lib=JSON.parse(d)}catch(e){}
if(!lib.shelves||!lib.shelves.length){lib={shelves:[
  {id:uid(),name:'文学',expanded:false,layers:[{id:uid(),name:'第一层',books:[]}]},
  {id:uid(),name:'哲学',expanded:false,layers:[{id:uid(),name:'第一层',books:[]}]},
  {id:uid(),name:'计算机',expanded:false,layers:[{id:uid(),name:'第一层',books:[]}]},
  {id:uid(),name:'历史',expanded:false,layers:[{id:uid(),name:'第一层',books:[]}]}
]}}}
function allBooks(){const r=[];lib.shelves.forEach(s=>s.layers.forEach(l=>l.books.forEach(b=>{r.push({...b,_sn:s.name,_ln:l.name,_si:s.id,_li:l.id})})));return r}
function findBook(id){for(const s of lib.shelves)for(const l of s.layers)for(const b of l.books)if(b.id===id)return{s,l,b};return null}

// --- 认证与 UI 更新 ---
function updateAuthUI() {
  const area = $('authArea');
  if (!area) return;
  if (currentUser) {
    area.innerHTML = `
      <div class="auth-bar">
        <span class="auth-email" title="${currentUser.email}">${currentUser.email}</span>
        <div class="auth-divider"></div>
        <button class="btn btn-ghost btn-sm" onclick="signOut()">退出</button>
      </div>`;
  } else {
    area.innerHTML = `<button class="btn btn-primary btn-sm" onclick="showAuthModal()">登录 / 同步</button>`;
  }
}

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
    </div>`;
  $('mFtr').innerHTML = '';
  openModal();
}

// --- 云端同步与封面上传 ---
async function loadFromCloud() {
  if (!currentUser) return;
  // 保存当前展开状态
  const expandedIds = new Set(lib.shelves.filter(s => s.expanded).map(s => s.id));
  const expandedNames = new Set(lib.shelves.filter(s => s.expanded).map(s => s.name));
  try {
    const { data: shelves } = await supa.from('shelves').select('*').order('sort_order');
    if (!shelves.length) return; 
    const sids = shelves.map(s => s.id);
    const { data: layers } = await supa.from('layers').select('*').in('shelf_id', sids).order('sort_order');
    const lids = layers.map(l => l.id);
    const { data: books } = await supa.from('books').select('*').in('layer_id', lids).order('sort_order');

    lib.shelves = shelves.map(s => ({
      id: s.id, name: s.name,
      expanded: s.expanded || expandedIds.has(s.id) || expandedNames.has(s.name),
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
    render(); toast('已从云端同步');
  } catch(e) { console.error(e); load(); render(); toast('云端同步失败，使用本地数据'); }
}

async function saveToCloud() {
  if (!currentUser) { localStorage.setItem('il-data',JSON.stringify(lib)); toast('已保存本地'); return; }
  try {
    // 简化处理：先删除旧数据再写入
    await supa.from('shelves').delete().eq('user_id', currentUser.id);
    const sr = lib.shelves.map((s,i) => ({id:s.id, user_id:currentUser.id, name:s.name, sort_order:i, expanded:!!s.expanded}));
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
      const {error}=await supa.from('books').insert(br.slice(i,i+500)); if(error)throw error;
    }
    localStorage.setItem('il-data',JSON.stringify(lib));
    toast('已同步到云端');
  } catch(e) { console.error(e); localStorage.setItem('il-data',JSON.stringify(lib)); toast('同步失败，已存本地'); }
}

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

// ─── RENDER ───
function render(){
  const g=$('grid'),total=allBooks().length;
  $('totalCount').textContent='共 '+total+' 本藏书';
  let h='';
  lib.shelves.forEach((shelf,si)=>{
    const cnt=shelf.layers.reduce((a,l)=>a+l.books.length,0);
    const ex=shelf.expanded?'expanded':'';
    h+='<div class="bookshelf" data-shelf-id="'+shelf.id+'" ondragover="shelfDragOver(event)" ondrop="shelfDrop(event,\''+shelf.id+'\')" ondragleave="shelfDragLeave(event)">';
    h+='<div class="shelf-header" onclick="togShelf(\''+shelf.id+'\')">';
    h+='<div class="shelf-header-left">';
    h+='<span class="drag-handle" draggable="true" ondragstart="shelfDragStart(event,\''+shelf.id+'\')" onclick="event.stopPropagation()" title="拖拽排序">⠿</span>';
    h+='<span class="shelf-name">'+esc(shelf.name)+'</span><span class="shelf-count">['+cnt+']</span></div>';
    h+='<div style="display:flex;align-items:center;gap:3px">';
    h+='<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();editShelf(\''+shelf.id+'\')" title="重命名">✎</button>';
    h+='<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();delShelf(\''+shelf.id+'\')" title="删除">✕</button>';
    h+='<span class="shelf-toggle '+ex+'">▼</span></div></div>';
    h+='<div class="shelf-body '+ex+'">';
    shelf.layers.forEach((layer,li)=>{
      h+='<div class="shelf-layer" data-layer-id="'+layer.id+'" data-shelf-id="'+shelf.id+'" ondragover="layerDragOver(event,\''+shelf.id+'\')" ondrop="layerDrop(event,\''+shelf.id+'\',\''+layer.id+'\')" ondragleave="layerDragLeave(event)">';
      h+='<div class="layer-header">';
      h+='<div style="display:flex;align-items:center;gap:4px">';
      h+='<span class="layer-drag-handle" draggable="true" ondragstart="layerDragStart(event,\''+shelf.id+'\',\''+layer.id+'\')" title="拖拽排序">⠿</span>';
      h+='<span class="layer-name" ondblclick="editLayer(\''+shelf.id+'\',\''+layer.id+'\')">'+esc(layer.name)+'</span></div>';
      h+='<div class="layer-actions"><button class="btn btn-ghost btn-sm" onclick="openAdd(\''+shelf.id+'\',\''+layer.id+'\')">+ 书</button>';
      h+='<button class="btn btn-ghost btn-sm" onclick="delLayer(\''+shelf.id+'\',\''+layer.id+'\')">✕</button></div></div>';
      h+='<div class="book-spine-row" ondragover="dOver(event)" ondrop="dDrop(event,\''+shelf.id+'\',\''+layer.id+'\')">';
      if(!layer.books.length){h+='<div class="empty-state" style="width:100%">空架位</div>';}
      else{layer.books.forEach(bk=>{
        if(searchRes&&!searchRes.includes(bk.id))return;
        const bg=bk.coverType==='image'&&bk.coverImage?'background:url('+bk.coverImage+') center/cover':'background:'+(bk.coverColor||'#6B6E76');
        const ht=Math.min(115,Math.max(55,55+(bk.title||'').length*3));
        const tc=isLight(bk.coverColor)?'#1A1B1E':'#F5F0E8';
        const st=(bk.title||'').length>7?bk.title.slice(0,7)+'…':bk.title;
        h+='<div class="book-spine status-'+bk.status+'" style="'+bg+';height:'+ht+'px" draggable="true" ';
        h+='ondragstart="dStart(event,\''+bk.id+'\',\''+shelf.id+'\',\''+layer.id+'\')" ';
        h+='onmouseenter="showTip(event,\''+bk.id+'\')" onmouseleave="hideTip()" ';
        h+='onclick="openDet(\''+bk.id+'\',\''+shelf.id+'\',\''+layer.id+'\')">';
        h+='<span style="color:'+tc+'">'+esc(st)+'</span></div>';
      });}
      h+='</div></div>';
    });
    h+='<div class="shelf-footer"><button class="btn btn-ghost btn-sm" onclick="addLayer(\''+shelf.id+'\')">+ 添加层</button></div>';
    // Fade overlay (hidden when expanded)
    h+='<div class="shelf-fade"></div>';
    h+='</div>';
    // Expand/collapse button below body
    if(shelf.layers.length>2||cnt>6){
      h+='<div class="shelf-expand-btn '+ex+'" onclick="togShelf(\''+shelf.id+'\')"><span class="ex-arrow">▼</span> '+(shelf.expanded?'收起':'展开全部 · '+shelf.layers.length+'层 '+cnt+'本')+'</div>';
    }
    h+='</div>';
    });
  h+='<div class="add-shelf" onclick="addShelf()"><span style="font-size:24px;color:var(--wi)">+</span><span>添加新书架</span></div>';
  g.innerHTML=h;
}

// ─── SHELF / LAYER OPS ───
function togShelf(id){const s=lib.shelves.find(x=>x.id===id);if(s){s.expanded=!s.expanded;render()}}
function addShelf(){prompt_('新建书架','书架名称','',n=>{if(!n.trim())return;lib.shelves.push({id:uid(),name:n.trim(),expanded:true,layers:[{id:uid(),name:'第一层',books:[]}]});save();render()})}
function editShelf(id){const s=lib.shelves.find(x=>x.id===id);if(!s)return;prompt_('重命名','书架名称',s.name,n=>{if(n.trim()){s.name=n.trim();save();render()}})}
async function delShelf(id){if(!await cfm('确定删除此书架？'))return;lib.shelves=lib.shelves.filter(s=>s.id!==id);save();render()}
function addLayer(sid){const s=lib.shelves.find(x=>x.id===sid);if(!s)return;prompt_('添加层','层名称','第'+(s.layers.length+1)+'层',n=>{if(!n.trim())return;s.layers.push({id:uid(),name:n.trim(),books:[]});save();render()})}
function editLayer(sid,lid){const s=lib.shelves.find(x=>x.id===sid);const l=s&&s.layers.find(x=>x.id===lid);if(!l)return;prompt_('重命名','层名称',l.name,n=>{if(n.trim()){l.name=n.trim();save();render()}})}
async function delLayer(sid,lid){const s=lib.shelves.find(x=>x.id===sid);if(!s||s.layers.length<=1)return toast('至少保留一层');if(!await cfm('确定删除此层？'))return;s.layers=s.layers.filter(l=>l.id!==lid);save();render()}

// ─── TOOLTIP ───
function showTip(e,bid){
  const info=findBook(bid);if(!info)return;const b=info.b;
  const t=$('tip');
  let h='<div class="tooltip-title">'+esc(b.title)+'</div>';
  h+='<div class="tooltip-author">'+esc(b.author||'')+(b.nationality?' · '+esc(b.nationality):'')+'</div>';
  h+='<div class="tooltip-rating">'+stars(b.rating||0)+'</div>';
  if(b.tags&&b.tags.length){h+='<div class="tooltip-tags">';b.tags.forEach((tg,i)=>h+='<span class="tooltip-tag '+(i<1?'primary':'')+'">'+esc(tg)+'</span>');h+='</div>';}
  if(b.notes)h+='<div class="tooltip-notes">'+esc(b.notes)+'</div>';
  h+='<div class="tooltip-status">'+SM[b.status||'unread']+(b.dateAdded?' · '+b.dateAdded:'')+'</div>';
  t.innerHTML=h;t.classList.add('visible');
  const r=e.target.getBoundingClientRect();
  let l=r.right+10,tp=r.top;
  if(l+270>window.innerWidth)l=r.left-272;
  if(tp+280>window.innerHeight)tp=window.innerHeight-290;
  if(tp<5)tp=5;
  t.style.left=l+'px';t.style.top=tp+'px';
}
function hideTip(){$('tip').classList.remove('visible')}

// ─── DETAIL ───
function openDet(bid,sid,lid){
  curBid=bid;curSid=sid;curLid=lid;
  const info=findBook(bid);if(!info)return;const b=info.b;
  const cv=$('dcv');
  if(b.coverType==='image'&&b.coverImage)cv.innerHTML='<img src="'+b.coverImage+'">';
  else{const tc=isLight(b.coverColor)?'#1A1B1E':'#F5F0E8';cv.innerHTML='<div class="detail-color" style="background:'+(b.coverColor||'#6B6E76')+';color:'+tc+'">'+esc((b.title||'').slice(0,4))+'</div>';}
  let h='<div class="detail-title">'+esc(b.title)+'</div>';
  h+='<div class="detail-author">'+esc(b.author||'')+'</div>';
  h+='<div style="margin-bottom:10px;color:var(--br);font-size:14px;letter-spacing:2px">'+stars(b.rating||0)+'</div>';
  h+='<div class="status-sel" style="margin-bottom:14px">';
  ['unread','reading','read'].forEach(st=>{const c=b.status===st?' a-'+st:'';h+='<button class="status-opt'+c+'" onclick="chgSt(\''+bid+'\',\''+st+'\')">'+SM[st]+'</button>';});
  h+='</div>';
  h+='<div class="detail-meta">';
  h+='<div class="detail-meta-item"><label>国籍</label><span>'+esc(b.nationality||'-')+'</span></div>';
  h+='<div class="detail-meta-item"><label>出版社</label><span>'+esc(b.publisher||'-')+'</span></div>';
  h+='<div class="detail-meta-item"><label>添加日期</label><span>'+esc(b.dateAdded||'-')+'</span></div>';
  h+='<div class="detail-meta-item"><label>读完日期</label><span>'+esc(b.dateFinished||'-')+'</span></div>';
  h+='</div>';
  if(b.tags&&b.tags.length){h+='<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px">';b.tags.forEach(t=>h+='<span class="tooltip-tag primary">'+esc(t)+'</span>');h+='</div>';}
  h+='<div class="detail-notes"><h4>阅读感想</h4><p>'+(b.notes?esc(b.notes):'暂无感想')+'</p></div>';
  $('dct').innerHTML=h;
  $('dpn').classList.add('open');$('dbk').classList.add('open');
}
function closeDet(){$('dpn').classList.remove('open');$('dbk').classList.remove('open');curBid=null}
function chgSt(bid,st){const info=findBook(bid);if(!info)return;info.b.status=st;if(st==='read'&&!info.b.dateFinished)info.b.dateFinished=new Date().toISOString().slice(0,10);save();render();openDet(bid,curSid,curLid)}

// ─── BOOK FORM ───
let _ct='color',_cc='#C8956C',_ci='',_rt=0,_st='unread';
function openAdd(sid,lid){curSid=sid;curLid=lid;showForm(null)}
function showForm(bk){
  const edit=!!bk;
  $('mTtl').textContent=edit?'编辑书籍':'添加书籍';
  _ct=bk?.coverType||'color';_cc=bk?.coverColor||'#C8956C';_ci=bk?.coverImage||'';_rt=bk?.rating||0;_st=bk?.status||'unread';
  let h='<div class="form-group"><label class="form-label">书名 *</label><input class="form-input" id="fT" value="'+esc(bk?.title||'')+'"></div>';
  h+='<div class="form-row"><div class="form-group"><label class="form-label">作者</label><input class="form-input" id="fA" value="'+esc(bk?.author||'')+'"></div>';
  h+='<div class="form-group"><label class="form-label">国籍</label><input class="form-input" id="fN" value="'+esc(bk?.nationality||'')+'"></div></div>';
  h+='<div class="form-group"><label class="form-label">出版社</label><input class="form-input" id="fP" value="'+esc(bk?.publisher||'')+'"></div>';
  h+='<div class="form-group"><label class="form-label">标签</label><input class="form-input" id="fTg" value="'+esc((bk?.tags||[]).join(', '))+'" placeholder="用逗号分隔"><div class="form-hint">多个标签用逗号分隔</div></div>';
  h+='<div class="form-group"><label class="form-label">封面</label>';
  h+='<div class="cover-toggle"><button class="'+(_ct==='color'?'active':'')+'" onclick="swCov(\'color\')">选择颜色</button><button class="'+(_ct==='image'?'active':'')+'" onclick="swCov(\'image\')">上传图片</button></div>';
  h+='<div id="covCol" style="'+(_ct==='image'?'display:none':'')+'">';
  h+='<div class="color-presets">';COLORS.forEach(c=>{h+='<div class="color-preset'+(_cc===c?' sel':'')+'" style="background:'+c+'" onclick="pickC(\''+c+'\')"></div>';});
  h+='</div><div style="display:flex;align-items:center;gap:8px;margin-top:6px"><input type="color" id="fCP" value="'+_cc+'" style="width:36px;height:28px;border:1px solid var(--bl);border-radius:4px;cursor:pointer;background:none;padding:0" onchange="pickC(this.value)"><span style="font-size:11px;color:var(--dm)" id="fCL">'+_cc+'</span></div></div>';
  h+='<div id="covImg" style="'+(_ct==='color'?'display:none':'')+'">';
  h+='<div class="file-upload" onclick="$(\'covFile\').click()">';
  if(_ci)h+='<img src="'+_ci+'">';
  h+='<div id="upTxt" style="font-family:var(--fl);font-size:12px;color:var(--dm)">'+(_ci?'点击更换':'点击上传封面')+'</div></div></div></div>';
  h+='<div class="form-group"><label class="form-label">评分</label><div class="star-rating" id="fR">';
  for(let i=1;i<=5;i++)h+='<span class="star'+(_rt>=i?' filled':'')+'" onclick="setR('+i+')">★</span>';
  h+='</div></div>';
  h+='<div class="form-group"><label class="form-label">阅读状态</label><div class="status-sel" id="fSt">';
  ['unread','reading','read'].forEach(s=>{h+='<button class="status-opt'+(_st===s?' a-'+s:'')+'" onclick="setSt(\''+s+'\')">'+SM[s]+'</button>';});
  h+='</div></div>';
  h+='<div class="form-group"><label class="form-label">阅读感想</label><textarea class="form-textarea" id="fNo" rows="3" placeholder="记录你的阅读感悟…">'+esc(bk?.notes||'')+'</textarea></div>';
  $('mBdy').innerHTML=h;
  $('mFtr').innerHTML='<button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="saveBk('+(edit?"'"+bk.id+"'":"null")+')">'+( edit?'保存':'添加')+'</button>';
  openModal();setTimeout(()=>{const el=$('fT');if(el)el.focus()},100);
}
function swCov(t){_ct=t;document.querySelectorAll('.cover-toggle button').forEach((b,i)=>b.classList.toggle('active',(t==='color'?i===0:i===1)));$('covCol').style.display=t==='color'?'':'none';$('covImg').style.display=t==='image'?'':'none'}
function pickC(c){_cc=c;document.querySelectorAll('.color-preset').forEach(el=>el.classList.toggle('sel',el.style.background===c||el.style.backgroundColor===c));const cp=$('fCP');if(cp)cp.value=c;const cl=$('fCL');if(cl)cl.textContent=c}
function setR(n){_rt=n;document.querySelectorAll('#fR .star').forEach((s,i)=>s.classList.toggle('filled',i<n))}
function setSt(s){_st=s;document.querySelectorAll('#fSt .status-opt').forEach(el=>{el.className='status-opt';if(el.textContent===SM[s])el.classList.add('a-'+s)})}
function saveBk(editId){
  const title=$('fT').value.trim();if(!title){toast('请输入书名');return}
  const bk={id:editId||uid(),title,author:$('fA').value.trim(),nationality:$('fN').value.trim(),publisher:$('fP').value.trim(),
    tags:$('fTg').value.split(/[,，]/).map(t=>t.trim()).filter(Boolean),notes:$('fNo').value.trim(),
    rating:_rt,coverType:_ct,coverColor:_cc,coverImage:_ci,status:_st,
    dateAdded:editId?(findBook(editId)?.b.dateAdded||new Date().toISOString().slice(0,10)):new Date().toISOString().slice(0,10),
    dateFinished:_st==='read'?(editId&&findBook(editId)?.b.dateFinished||new Date().toISOString().slice(0,10)):''};
  if(editId){for(const s of lib.shelves)for(const l of s.layers)for(let i=0;i<l.books.length;i++)if(l.books[i].id===editId)l.books[i]=bk;}
  else{const s=lib.shelves.find(x=>x.id===curSid);const l=s?.layers.find(x=>x.id===curLid);if(l)l.books.push(bk)}
  closeModal();save();render();toast(editId?'已更新':'已添加: '+title);
}
//支持异步上传
$('covFile').onchange = async function(e) {
  const f = e.target.files[0];
  if (!f) return;
  try {
    toast('正在处理封面...');
    _ci = await uploadCover(f); // 调用新上传函数
    const img = $('covImg')?.querySelector('img');
    if (img) img.src = _ci;
    else {
      const fu = $('covImg')?.querySelector('.file-upload');
      if (fu) fu.insertAdjacentHTML('afterbegin', '<img src="' + _ci + '">');
    }
    const ut = $('upTxt');
    if (ut) ut.textContent = '点击更换';
  } catch (err) {
    toast('上传失败: ' + err.message);
  }
};

// ─── MODAL ───
function openModal(){$('mOvl').classList.add('open')}
function closeModal(){$('mOvl').classList.remove('open')}
function prompt_(title,label,val,cb){
  $('mTtl').textContent=title;
  $('mBdy').innerHTML='<div class="form-group"><label class="form-label">'+esc(label)+'</label><input class="form-input" id="pI" value="'+esc(val)+'"></div>';
  $('mFtr').innerHTML='<button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" id="pOk">确定</button>';
  $('pOk').onclick=()=>{cb($('pI').value);closeModal()};
  openModal();setTimeout(()=>$('pI').focus(),100);
}
$('mOvl').onclick=function(e){if(e.target===this)closeModal()};

// ─── DRAG & DROP (Books) ───
function dStart(e,bid,sid,lid){dragD={type:'book',bid,sid,lid};e.dataTransfer.setData('text/plain','book');e.target.classList.add('dragging');e.dataTransfer.effectAllowed='move'}
function dOver(e){e.preventDefault();if(dragD?.type!=='book')return;e.currentTarget.classList.add('drag-over')}
function dDrop(e,tsid,tlid){
  e.preventDefault();e.stopPropagation();e.currentTarget.classList.remove('drag-over');
  if(!dragD||dragD.type!=='book')return;
  const ss=lib.shelves.find(x=>x.id===dragD.sid);const sl=ss?.layers.find(x=>x.id===dragD.lid);
  const bk=sl?.books.find(x=>x.id===dragD.bid);if(!bk)return;
  sl.books=sl.books.filter(x=>x.id!==dragD.bid);
  const ts=lib.shelves.find(x=>x.id===tsid);const tl=ts?.layers.find(x=>x.id===tlid);
  if(tl)tl.books.push(bk);
  dragD=null;save();render();toast('已移动');
}

// ─── DRAG & DROP (Shelves reorder) ───
let shelfDragId=null;
function shelfDragStart(e,sid){e.stopPropagation();shelfDragId=sid;dragD={type:'shelf'};e.dataTransfer.setData('text/plain','shelf');e.dataTransfer.effectAllowed='move';const el=e.target.closest('.bookshelf');if(el)setTimeout(()=>el.classList.add('shelf-dragging'),0)}
function shelfDragOver(e){if(dragD?.type!=='shelf')return;e.preventDefault();e.stopPropagation();const el=e.currentTarget;document.querySelectorAll('.shelf-drag-over').forEach(x=>x.classList.remove('shelf-drag-over'));if(el.classList.contains('bookshelf')&&el.dataset.shelfId!==shelfDragId)el.classList.add('shelf-drag-over')}
function shelfDragLeave(e){if(dragD?.type!=='shelf')return;e.currentTarget.classList.remove('shelf-drag-over')}
function shelfDrop(e,targetId){
  e.preventDefault();e.stopPropagation();document.querySelectorAll('.shelf-drag-over,.shelf-dragging').forEach(x=>{x.classList.remove('shelf-drag-over');x.classList.remove('shelf-dragging')});
  if(!shelfDragId||dragD?.type!=='shelf'||shelfDragId===targetId){shelfDragId=null;dragD=null;return}
  const fromIdx=lib.shelves.findIndex(s=>s.id===shelfDragId);const toIdx=lib.shelves.findIndex(s=>s.id===targetId);
  if(fromIdx<0||toIdx<0){shelfDragId=null;dragD=null;return}
  const [moved]=lib.shelves.splice(fromIdx,1);lib.shelves.splice(toIdx,0,moved);
  shelfDragId=null;dragD=null;save();render();toast('书架已排序');
}

// ─── DRAG & DROP (Layers reorder within shelf) ───
let layerDragInfo=null;
function layerDragStart(e,sid,lid){e.stopPropagation();layerDragInfo={sid,lid};dragD={type:'layer'};e.dataTransfer.setData('text/plain','layer');e.dataTransfer.effectAllowed='move';const el=e.target.closest('.shelf-layer');if(el)setTimeout(()=>el.classList.add('layer-dragging'),0)}
function layerDragOver(e,sid){if(dragD?.type!=='layer')return;if(layerDragInfo?.sid!==sid)return;e.preventDefault();e.stopPropagation();const el=e.currentTarget;document.querySelectorAll('.layer-drag-over').forEach(x=>x.classList.remove('layer-drag-over'));if(el.classList.contains('shelf-layer')&&el.dataset.layerId!==layerDragInfo?.lid)el.classList.add('layer-drag-over')}
function layerDragLeave(e){if(dragD?.type!=='layer')return;e.currentTarget.classList.remove('layer-drag-over')}
function layerDrop(e,sid,targetLid){
  e.preventDefault();e.stopPropagation();document.querySelectorAll('.layer-drag-over,.layer-dragging').forEach(x=>{x.classList.remove('layer-drag-over');x.classList.remove('layer-dragging')});
  if(!layerDragInfo||dragD?.type!=='layer'||layerDragInfo.sid!==sid||layerDragInfo.lid===targetLid){layerDragInfo=null;dragD=null;return}
  const shelf=lib.shelves.find(s=>s.id===sid);if(!shelf){layerDragInfo=null;dragD=null;return}
  const fromIdx=shelf.layers.findIndex(l=>l.id===layerDragInfo.lid);const toIdx=shelf.layers.findIndex(l=>l.id===targetLid);
  if(fromIdx<0||toIdx<0){layerDragInfo=null;dragD=null;return}
  const [moved]=shelf.layers.splice(fromIdx,1);shelf.layers.splice(toIdx,0,moved);
  layerDragInfo=null;dragD=null;save();render();toast('层已排序');
}
document.addEventListener('dragend',()=>{dragD=null;shelfDragId=null;layerDragInfo=null;document.querySelectorAll('.dragging,.drag-over,.shelf-dragging,.shelf-drag-over,.layer-dragging,.layer-drag-over').forEach(el=>el.classList.remove('dragging','drag-over','shelf-dragging','shelf-drag-over','layer-dragging','layer-drag-over'))});

// ─── DETAIL BUTTONS ───
$('editBtn').onclick=()=>{if(!curBid)return;const info=findBook(curBid);if(!info)return;closeDet();showForm(info.b)};
$('delBtn').onclick=async()=>{if(!curBid)return;if(!await cfm('确定删除此书？'))return;for(const s of lib.shelves)for(const l of s.layers)l.books=l.books.filter(b=>b.id!==curBid);closeDet();save();render();toast('已删除')};
$('closeBtn').onclick=closeDet;$('dbk').onclick=closeDet;

// ─── SEARCH ───
$('searchInput').oninput=function(){const q=this.value.trim().toLowerCase();if(!q){searchRes=null;render();return}const all=allBooks();const ids=all.filter(b=>(b.title||'').toLowerCase().includes(q)||(b.author||'').toLowerCase().includes(q)||(b.tags||[]).some(t=>t.toLowerCase().includes(q))||(b.notes||'').toLowerCase().includes(q)).map(b=>b.id);searchRes=ids;lib.shelves.forEach(s=>{if(s.layers.some(l=>l.books.some(b=>ids.includes(b.id))))s.expanded=true});render()};
$('advBtn').onclick=()=>$('advPanel').classList.toggle('open');
function runAdv(){
  const t=$('aT').value.trim().toLowerCase(),a=$('aA').value.trim().toLowerCase(),mr=parseInt($('aR').value),n=$('aN').value.trim().toLowerCase(),tg=$('aTg').value.trim().toLowerCase(),st=$('aS').value;
  const all=allBooks();const ids=all.filter(b=>{
    if(t&&!(b.title||'').toLowerCase().includes(t))return false;if(a&&!(b.author||'').toLowerCase().includes(a))return false;
    if(mr&&(b.rating||0)<mr)return false;if(n&&!(b.notes||'').toLowerCase().includes(n))return false;
    if(tg&&!(b.tags||[]).some(x=>x.toLowerCase().includes(tg)))return false;if(st&&b.status!==st)return false;return true;
  }).map(b=>b.id);
  searchRes=ids;lib.shelves.forEach(s=>{if(s.layers.some(l=>l.books.some(b=>ids.includes(b.id))))s.expanded=true});
  render();$('advPanel').classList.remove('open');toast('找到 '+ids.length+' 本');
}
function clearAdv(){['aT','aA','aN','aTg'].forEach(id=>$(id).value='');$('aR').value='0';$('aS').value='';searchRes=null;render()}
document.addEventListener('click',e=>{if(!$('advPanel').contains(e.target)&&e.target!==$('advBtn'))$('advPanel').classList.remove('open')});

// ─── IMPORT / EXPORT ───
$('exportBtn').onclick=()=>{const d=JSON.stringify(lib,null,2);const b=new Blob([d],{type:'application/json'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='library-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(u);toast('已导出')};
$('importBtn').onclick=()=>$('impFile').click();
$('impFile').onchange=function(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=async ev=>{try{const d=JSON.parse(ev.target.result);if(d.shelves&&Array.isArray(d.shelves)){if(await cfm('导入将合并到现有书单，继续？')){d.shelves.forEach(s=>{const ex=lib.shelves.find(es=>es.name===s.name);if(ex){s.layers.forEach(l=>{const el=ex.layers.find(x=>x.name===l.name);if(el){l.books.forEach(b=>{if(!el.books.find(x=>x.title===b.title&&x.author===b.author))el.books.push({...b,id:uid()})})}else ex.layers.push({...l,id:uid(),books:l.books.map(b=>({...b,id:uid()}))})})}else lib.shelves.push({...s,id:uid(),layers:s.layers.map(l=>({...l,id:uid(),books:l.books.map(b=>({...b,id:uid()}))}))})});save();render();toast('导入成功')}}else toast('无效格式')}catch(err){toast('解析失败')}};r.readAsText(f);this.value=''};

// ─── SAVE ───
$('saveBtn').onclick=save;$('addShelfBtn').onclick=addShelf;

// ─── TABS ───
document.querySelectorAll('.tab-btn').forEach(btn=>{btn.onclick=function(){document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));this.classList.add('active');$('tab-'+this.dataset.tab).classList.add('active');if(this.dataset.tab==='stats')renderStats()}});

// ─── STATS ───
function renderStats(){
  const all=allBooks(),yrs=[...new Set(all.map(b=>(b.dateAdded||'').slice(0,4)).filter(Boolean))].sort().reverse();
  if(!yrs.length)yrs.push(''+new Date().getFullYear());
  $('statsYear').innerHTML=yrs.map(y=>'<option value="'+y+'">'+y+'</option>').join('')+'<option value="all">全部</option>';
  $('statsYear').onchange=()=>buildStats($('statsYear').value);buildStats(yrs[0]||'all');
}
function buildStats(yr){
  const all=allBooks(),f=yr==='all'?all:all.filter(b=>(b.dateAdded||'').startsWith(yr));
  const rd=f.filter(b=>b.status==='read').length,rg=f.filter(b=>b.status==='reading').length,ur=f.filter(b=>b.status==='unread').length;
  const readWithRating = f.filter(b => b.status === 'read' && b.rating > 0);
  const avg = readWithRating.length 
    ? (readWithRating.reduce((a, b) => a + b.rating, 0) / readWithRating.length).toFixed(1)
    : "—";
  let h='<div class="stats-grid">';
  h+=sc(f.length,'总藏书')+sc(rd,'已读')+sc(rg,'在读')+sc(avg,'平均分');
  h+='</div>';
  const shC={};lib.shelves.forEach(s=>{const c=s.layers.reduce((a,l)=>a+l.books.filter(b=>yr==='all'||(b.dateAdded||'').startsWith(yr)).length,0);if(c>0)shC[s.name]=c});
  const mx=Math.max(...Object.values(shC),1);
  h+='<div class="stats-chart"><h3>书架分布</h3><div class="bar-chart">';
  Object.entries(shC).sort((a,b)=>b[1]-a[1]).forEach(([n,c])=>{h+='<div class="bar-row"><span class="bar-label">'+esc(n)+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.round(c/mx*100)+'%">'+c+'</div></div></div>'});
  h+='</div></div>';
  const tC={};f.forEach(b=>(b.tags||[]).forEach(t=>{tC[t]=(tC[t]||0)+1}));
  const topT=Object.entries(tC).sort((a,b)=>b[1]-a[1]).slice(0,10),mtg=Math.max(...Object.values(tC),1);
  if(topT.length){h+='<div class="stats-chart"><h3>热门标签</h3><div class="bar-chart">';topT.forEach(([t,c])=>{h+='<div class="bar-row"><span class="bar-label">'+esc(t)+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.round(c/mtg*100)+'%">'+c+'</div></div></div>'});h+='</div></div>'}
  const mc={};f.filter(b=>b.status==='read'&&b.dateFinished).forEach(b=>{const m=b.dateFinished.slice(0,7);mc[m]=(mc[m]||0)+1});
  const ms=Object.keys(mc).sort(),mm=Math.max(...Object.values(mc),1);
  if(ms.length){h+='<div class="stats-chart"><h3>月度阅读</h3><div class="bar-chart">';ms.forEach(m=>{h+='<div class="bar-row"><span class="bar-label">'+m+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.round(mc[m]/mm*100)+'%">'+mc[m]+'</div></div></div>'});h+='</div></div>'}
  $('statsBox').innerHTML=h;
}
function sc(n,l){return '<div class="stat-card"><div class="stat-num">'+n+'</div><div class="stat-lbl">'+l+'</div></div>'}

// ─── KEYBOARD ───
document.onkeydown=function(e){
  if(e.key==='Escape'){closeModal();closeDet();$('advPanel').classList.remove('open');if(_cfmR){_cfmR(false);_cfmR=null;$('cfmOvl').classList.remove('open')}}
  if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();save()}
  if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();$('searchInput').focus()}
};

// ─── INIT ───
function initApp() {
  load(); // 优先加载本地数据提升速度
  render();
  updateAuthUI();
}

initApp();
$('cfmYes').onclick=cfmY;$('cfmNo').onclick=cfmN;$('cfmOvl').onclick=function(e){if(e.target===this)cfmN()};
