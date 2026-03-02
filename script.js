// --- 数据初始化 ---
let libraryData = JSON.parse(localStorage.getItem('booo_data')) || [
    { id: Date.now(), name: "默认书架", layers: [{ id: Date.now()+1, name: "第一层", books: [] }] }
];

let activeContext = { sIdx: null, lIdx: null, bIdx: null };

// --- 渲染核心 ---
function render(dataToRender = libraryData) {
    const container = document.getElementById('library');
    container.innerHTML = '';

    dataToRender.forEach((shelf, sIdx) => {
        const shelfDiv = document.createElement('div');
        shelfDiv.className = 'shelf';
        shelfDiv.innerHTML = `
            <div class="shelf-header">
                <h3 contenteditable="true" onblur="updateShelfName(${sIdx}, this)">${shelf.name}</h3>
                <button class="btn-mini-danger" onclick="deleteShelf(${sIdx})">×</button>
            </div>
            <div class="layers-container"></div>
            <div style="display:flex; gap:10px; margin-top:10px;">
                <button onclick="addLayer(${sIdx})" style="flex:1; font-size:12px">+ 层级</button>
                <button class="btn-primary" onclick="openModal(${sIdx}, ${shelf.layers.length-1})" style="flex:2">+ 添加书籍</button>
            </div>
        `;
        container.appendChild(shelfDiv);

        const layersContainer = shelfDiv.querySelector('.layers-container');
        shelf.layers.forEach((layer, lIdx) => {
            const layerDiv = document.createElement('div');
            layerDiv.className = 'layer';
            layerDiv.innerHTML = `
                <div class="layer-header">
                    <span contenteditable="true" onblur="updateLayerName(${sIdx},${lIdx},this)">${layer.name}</span>
                    <span>${layer.books.length} 本</span>
                </div>
                <div class="book-row" data-s="${sIdx}" data-l="${lIdx}"></div>
            `;
            layersContainer.appendChild(layerDiv);

            const row = layerDiv.querySelector('.book-row');
            layer.books.forEach((book, bIdx) => {
                const bookEl = document.createElement('div');
                bookEl.className = `book-spine status-${book.status}`;
                bookEl.style.backgroundColor = book.color;
                bookEl.innerText = book.title;
                
                const tip = `【${book.title}】\n作者：${book.author}\n评分：${book.score}\n摘要：${book.thoughts.substring(0,40)}...`;
                bookEl.setAttribute('data-tip', tip);
                
                bookEl.onclick = (e) => { e.stopPropagation(); openModal(sIdx, lIdx, bIdx); };
                row.appendChild(bookEl);
            });

            // 跨书架拖拽核心配置
            new Sortable(row, {
                group: 'shared-library',
                animation: 200,
                ghostClass: 'sortable-ghost',
                onEnd: handleDragEnd
            });
        });
    });
}

// --- 拖拽处理 ---
function handleDragEnd(evt) {
    const fromS = parseInt(evt.from.dataset.s);
    const fromL = parseInt(evt.from.dataset.l);
    const toS = parseInt(evt.to.dataset.s);
    const toL = parseInt(evt.to.dataset.l);
    
    // 从原数组移除并获取该书
    const movedBook = libraryData[fromS].layers[fromL].books.splice(evt.oldIndex, 1)[0];
    // 插入到新位置
    libraryData[toS].layers[toL].books.splice(evt.newIndex, 0, movedBook);
    
    saveAndRefresh();
}

// --- 模态框逻辑 ---
function openModal(sIdx, lIdx, bIdx = null) {
    activeContext = { sIdx, lIdx, bIdx };
    document.getElementById('bookModal').classList.remove('hidden');
    
    if (bIdx !== null) {
        // 阅读模式
        const b = libraryData[sIdx].layers[lIdx].books[bIdx];
        showViewMode(b);
    } else {
        // 直接进入新增模式
        clearInputs();
        switchToEdit();
        document.getElementById('editHeader').innerText = "添加新书";
    }
}

function showViewMode(b) {
    document.getElementById('viewMode').classList.remove('hidden');
    document.getElementById('editMode').classList.add('hidden');
    document.getElementById('viewTitle').innerText = b.title;
    document.getElementById('viewAuthor').innerText = b.author;
    document.getElementById('viewCountry').innerText = b.nationality || '-';
    document.getElementById('viewPub').innerText = b.publisher || '-';
    document.getElementById('viewScore').innerText = b.score || '0';
    document.getElementById('viewThoughts').innerText = b.thoughts || '暂无感想';
    document.getElementById('viewTags').innerHTML = (b.tags || '').split(',').map(t => t.trim() ? `<span style="background:#eee; padding:2px 6px; border-radius:4px; font-size:10px; margin-right:4px;">#${t}</span>` : '').join('');
}

function switchToEdit() {
    document.getElementById('viewMode').classList.add('hidden');
    document.getElementById('editMode').classList.remove('hidden');
    document.getElementById('editHeader').innerText = "编辑书籍";
    
    const { sIdx, lIdx, bIdx } = activeContext;
    if(bIdx !== null) {
        const b = libraryData[sIdx].layers[lIdx].books[bIdx];
        document.getElementById('inputTitle').value = b.title;
        document.getElementById('inputAuthor').value = b.author;
        document.getElementById('inputCountry').value = b.nationality || '';
        document.getElementById('inputPub').value = b.publisher || '';
        document.getElementById('inputStatus').value = b.status;
        document.getElementById('inputScore').value = b.score;
        document.getElementById('inputColor').value = b.color;
        document.getElementById('inputTags').value = b.tags || '';
        document.getElementById('inputThoughts').value = b.thoughts;
    }
}

function handleCancel() {
    if (activeContext.bIdx === null) closeModal();
    else showViewMode(libraryData[activeContext.sIdx].layers[activeContext.lIdx].books[activeContext.bIdx]);
}

function saveBookChange() {
    const b = {
        title: document.getElementById('inputTitle').value || '未命名',
        author: document.getElementById('inputAuthor').value || '未知作者',
        nationality: document.getElementById('inputCountry').value,
        publisher: document.getElementById('inputPub').value,
        status: document.getElementById('inputStatus').value,
        score: document.getElementById('inputScore').value,
        color: document.getElementById('inputColor').value,
        tags: document.getElementById('inputTags').value,
        thoughts: document.getElementById('inputThoughts').value
    };

    if (activeContext.bIdx !== null) {
        libraryData[activeContext.sIdx].layers[activeContext.lIdx].books[activeContext.bIdx] = b;
    } else {
        libraryData[activeContext.sIdx].layers[activeContext.lIdx].books.push(b);
    }
    saveAndRefresh();
    closeModal();
}

function deleteBook() {
    if (!confirm("确定要删除这本书吗？")) return;
    libraryData[activeContext.sIdx].layers[activeContext.lIdx].books.splice(activeContext.bIdx, 1);
    saveAndRefresh();
    closeModal();
}

// --- 搜索与统计 ---
function runSearch() {
    const q = document.getElementById('globalSearch').value.toLowerCase();
    const authorQ = document.getElementById('searchAuthor').value.toLowerCase();
    const scoreQ = document.getElementById('searchScore').value;
    const thoughtQ = document.getElementById('searchThought').value.toLowerCase();

    const filtered = libraryData.map(shelf => ({
        ...shelf,
        layers: shelf.layers.map(layer => ({
            ...layer,
            books: layer.books.filter(b => {
                const mGlobal = b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
                const mAuthor = b.author.toLowerCase().includes(authorQ);
                const mScore = scoreQ ? b.score >= scoreQ : true;
                const mThought = b.thoughts.toLowerCase().includes(thoughtQ);
                return mGlobal && mAuthor && mScore && mThought;
            })
        }))
    }));
    render(filtered);
}

function showStats() {
    let total = 0, done = 0;
    libraryData.forEach(s => s.layers.forEach(l => {
        total += l.books.length;
        done += l.books.filter(b => b.status === 'finished').length;
    }));
    alert(`【Bookshelves Of Our Own 统计】\n目前藏书：${total} 本\n已读完成：${done} 本\n阅读完成率：${total ? Math.round(done/total*100) : 0}%`);
}

// --- 辅助功能 ---
function saveAndRefresh() { localStorage.setItem('booo_data', JSON.stringify(libraryData)); render(); }
function updateShelfName(i, el) { libraryData[i].name = el.innerText; localStorage.setItem('booo_data', JSON.stringify(libraryData)); }
function updateLayerName(si, li, el) { libraryData[si].layers[li].name = el.innerText; localStorage.setItem('booo_data', JSON.stringify(libraryData)); }
function addShelf() { libraryData.push({ id: Date.now(), name: "新书架", layers: [{ id: Date.now()+1, name: "第一层", books: [] }] }); saveAndRefresh(); }
function addLayer(si) { libraryData[si].layers.push({ id: Date.now(), name: "新层级", books: [] }); saveAndRefresh(); }
function deleteShelf(si) { if(confirm("删除整个书架？")) { libraryData.splice(si, 1); saveAndRefresh(); } }
function closeModal() { document.getElementById('bookModal').classList.add('hidden'); }
function clearInputs() { document.querySelectorAll('#editMode input, #editMode textarea').forEach(i => i.value = ''); document.getElementById('inputColor').value = '#ffd1dc'; }
function toggleAdvanced() { document.getElementById('advancedSearch').classList.toggle('hidden'); }

// --- 导入导出 ---
function exportJSON() {
    const blob = new Blob([JSON.stringify(libraryData)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = "my_library.json"; a.click();
}
function importJSON(e) {
    const reader = new FileReader();
    reader.onload = (event) => { libraryData = JSON.parse(event.target.result); saveAndRefresh(); };
    reader.readAsText(e.target.files[0]);
}

// 启动
render();