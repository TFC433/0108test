// public/scripts/products/products.js
// [Fix: 2026-01-08-UI-Safety]
// Description: 加入 DOM 元素安全檢查，防止因找不到按鈕導致的 "Cannot set properties of null" 錯誤

window.ProductManager = {
    allProducts: [],
    revealedCostIds: new Set(),
    categoryOrder: [], 
    isEditMode: false,
    hasBoundGlobalEvents: false,
    detailModal: null,

    async init() {
        const container = document.getElementById('page-products');
        if (!container) return;

        try {
            const html = await fetch('/views/product-list.html').then(res => res.text());
            container.innerHTML = html;
        } catch (err) {
            console.error('[Products] 載入失敗', err);
            return;
        }

        if (typeof ProductDetailModal !== 'undefined') {
            this.detailModal = new ProductDetailModal();
        } else {
            console.error('ProductDetailModal class not found!');
        }

        await this.loadCategoryOrder();
        this.injectToolbarControls();
        this.bindEvents();
        await this.loadData();
    },

    async loadData() {
        const container = document.getElementById('product-groups-container');
        if (this.allProducts.length === 0 && container) {
            container.innerHTML = `<div class="loading show"><div class="spinner"></div><p>載入商品資料中...</p></div>`;
        }
        try {
            const res = await authedFetch('/api/products');
            if (!res.success) throw new Error(res.error);
            this.allProducts = res.data || [];
            this.renderTable();
        } catch (error) {
            if(container) container.innerHTML = `<div class="alert alert-error">${error.message}</div>`;
        }
    },

    async loadCategoryOrder() {
        try {
            const res = await authedFetch('/api/products/category-order');
            if (res.success && Array.isArray(res.order)) this.categoryOrder = res.order;
        } catch (e) { console.warn('排序設定讀取失敗', e); }
    },

    async saveCategoryOrder(newOrder) {
        const statusEl = document.getElementById('order-save-status');
        if(statusEl) statusEl.textContent = '儲存中...';
        try {
            await authedFetch('/api/products/category-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order: newOrder })
            });
            this.categoryOrder = newOrder;
            if(statusEl) statusEl.textContent = '✓ 已儲存';
            this.renderTable(); 
        } catch (e) {
            if(statusEl) statusEl.textContent = '✕ 失敗';
        }
    },

    injectToolbarControls() {
        const panelActions = document.querySelector('.panel-actions');
        if (!panelActions || panelActions.querySelector('.product-actions-group')) return;

        const btnGroup = document.createElement('div');
        btnGroup.className = 'product-actions-group';
        btnGroup.style.display = 'flex';
        btnGroup.style.gap = '8px';

        btnGroup.innerHTML = `
            <button id="btn-add-row" class="action-btn secondary" style="display:none; white-space:nowrap;">＋ 新增</button>
            <button id="btn-toggle-edit" class="action-btn secondary" style="white-space:nowrap;">✏️ 列表編輯</button>
            <button id="btn-save-batch" class="action-btn primary" style="display:none; white-space:nowrap;">💾 儲存列表</button>
            <button id="btn-refresh-products" class="action-btn secondary" title="同步" style="white-space:nowrap;">⟳</button>
        `;
        panelActions.appendChild(btnGroup);
    },

    bindEvents() {
        const searchInput = document.getElementById('product-search-input');
        let debounceTimer;
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => this.renderTable(e.target.value), 300);
            });
        }

        if (this.hasBoundGlobalEvents) return;

        document.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;
            if (target.closest('.modal')) return;
            
            // 加入安全檢查，確保頁面元素存在
            const page = document.getElementById('page-products');
            if (!page || !page.contains(target)) return;

            if (target.id === 'btn-refresh-products') this.forceRefresh();
            if (target.id === 'btn-toggle-edit') this.setEditMode(!this.isEditMode);
            if (target.id === 'btn-save-batch') this.saveAll();
            if (target.id === 'btn-add-row') this.addNewRow();
            
            if (target.classList.contains('close-modal')) {
                if(this.detailModal) this.detailModal.close();
            }
        });

        window.addEventListener('click', (e) => {
            const modal = document.getElementById('product-detail-modal');
            if (modal && e.target === modal) {
                if(this.detailModal) this.detailModal.close();
                else modal.style.display = 'none';
            }
        });

        this.hasBoundGlobalEvents = true;
    },

    renderTable(query = '') {
        const container = document.getElementById('product-groups-container');
        const wallArea = document.getElementById('chip-wall-area');
        if (!container) return;

        let data = this.allProducts;
        
        if (query && !this.isEditMode) {
            const q = query.toLowerCase();
            data = data.filter(p => 
                (p.name && p.name.toLowerCase().includes(q)) ||
                (p.category && p.category.toLowerCase().includes(q)) ||
                (p.spec && p.spec.toLowerCase().includes(q))
            );
            if (wallArea) wallArea.style.display = 'none';
        } else {
            if (wallArea) wallArea.style.display = 'block';
            const wallContainer = document.querySelector('.chip-wall-container');
            if (wallContainer) {
                if (this.isEditMode) wallContainer.classList.add('disabled');
                else wallContainer.classList.remove('disabled');
            }
        }

        if (data.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:2rem; color:#888;">無資料</div>`;
            return;
        }

        const groups = {};
        data.forEach(item => {
            if(!item) return; 
            const cat = item.category ? item.category.trim() : '未分類';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
        });

        let displayCats = [];
        this.categoryOrder.forEach(c => { if (groups[c]) displayCats.push(c); });
        Object.keys(groups).forEach(c => { if (!displayCats.includes(c)) displayCats.push(c); });

        const newGroup = displayCats.find(cat => groups[cat].some(i => i._isNew));
        if (newGroup) {
            displayCats = displayCats.filter(c => c !== newGroup);
            displayCats.unshift(newGroup);
        }

        if (!this.isEditMode && !query) {
            this.initChipWall(displayCats, groups);
        }

        let html = '';
        const thWithResizer = (text, width) => `
            <th style="width: ${width};">
                ${text}
                <div class="resizer"></div>
            </th>
        `;

        displayCats.forEach(cat => {
            const items = groups[cat];
            const isNewGroup = items.some(i => i._isNew);
            const titleStyle = isNewGroup ? 'color:#2563eb;' : '';

            html += `
                <div class="category-group-widget" id="group-${cat}">
                    <div class="category-header">
                        <div class="category-title" style="${titleStyle}">
                            ${cat} 
                            <span style="font-size:0.8rem; color:#64748b; background:#e2e8f0; padding:1px 8px; border-radius:10px; margin-left:8px;">${items.length}</span>
                            ${isNewGroup ? '<span style="font-size:0.75rem; color:#fff; background:#2563eb; padding:1px 6px; border-radius:4px; margin-left:8px;">New</span>' : ''}
                        </div>
                    </div>
                    <table class="product-table">
                        <thead>
                            <tr>
                                ${thWithResizer('#', '50px')}
                                ${thWithResizer('商品名稱', '220px')}
                                ${thWithResizer('規格', '320px')}
                                ${thWithResizer('成本', '110px')}
                                ${thWithResizer('MTB', '110px')}
                                ${thWithResizer('SI', '110px')}
                                ${thWithResizer('MTU', '110px')}
                            </tr>
                        </thead>
                        <tbody>
            `;

            items.forEach((item, index) => {
                const originalIndex = this.allProducts.indexOf(item);
                const itemNum = index + 1;
                const fmtMoney = (v) => v ? `$ ${Number(v).toLocaleString()}` : '-';

                if (this.isEditMode) {
                    html += `
                        <tr class="edit-row" data-index="${originalIndex}">
                            <td class="text-muted">${itemNum}</td>
                            <input type="hidden" name="id" value="${item.id}"> 
                            <input type="hidden" name="category" value="${item.category}">
                            
                            <td><input type="text" name="name" class="form-control seamless" value="${item.name||''}" placeholder="名稱"></td>
                            <td><input type="text" name="spec" class="form-control seamless" value="${item.spec||''}" placeholder="規格"></td>
                            <td><input type="number" name="cost" class="form-control seamless" value="${item.cost||''}" placeholder="$"></td>
                            <td><input type="number" name="priceMtb" class="form-control seamless" value="${item.priceMtb||''}" placeholder="$"></td>
                            <td><input type="number" name="priceSi" class="form-control seamless" value="${item.priceSi ||''}" placeholder="$"></td>
                            <td><input type="number" name="priceMtu" class="form-control seamless" value="${item.priceMtu||''}" placeholder="$"></td>
                        </tr>
                    `;
                } else {
                    const costKey = `${item.id}_cost`;
                    const isRevealed = this.revealedCostIds.has(costKey);
                    const costDisplay = isRevealed ? fmtMoney(item.cost) : '$ $$$';
                    const costClass = isRevealed ? 'sensitive-value revealed' : 'sensitive-value masked';

                    html += `
                        <tr onclick="ProductManager.openDetailModal('${item.id}')">
                            <td class="text-muted font-mono">${itemNum}</td>
                            <td title="${item.name}">${item.name}</td>
                            <td title="${item.spec||''}"><span class="tag-pill tag-spec">${item.spec||'-'}</span></td>
                            
                            <td onclick="event.stopPropagation(); ProductManager.toggleCost('${item.id}')">
                                <span class="${costClass}">${costDisplay}</span>
                            </td>
                            
                            <td><span class="tag-pill tag-price">${fmtMoney(item.priceMtb)}</span></td>
                            <td><span class="tag-pill tag-price">${fmtMoney(item.priceSi)}</span></td>
                            <td><span class="tag-pill tag-price">${fmtMoney(item.priceMtu)}</span></td>
                        </tr>
                    `;
                }
            });
            html += `</tbody></table></div>`;
        });
        container.innerHTML = html;

        if (!this.isEditMode) {
            this.enableColumnResizing();
        }
    },

    enableColumnResizing() {
        const resizers = document.querySelectorAll('.resizer');
        resizers.forEach(resizer => {
            resizer.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const th = resizer.parentElement;
                const startX = e.pageX;
                const startWidth = th.offsetWidth;
                resizer.classList.add('resizing');

                const onMouseMove = (e) => {
                    const currentX = e.pageX;
                    const newWidth = startWidth + (currentX - startX);
                    if (newWidth > 30) th.style.width = `${newWidth}px`;
                };
                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    resizer.classList.remove('resizing');
                };
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    },

    initChipWall(categories, groups) {
        const listContainer = document.getElementById('category-chip-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';

        categories.forEach(cat => {
            const count = groups[cat] ? groups[cat].length : 0;
            const chip = document.createElement('div');
            chip.className = 'chip-item';
            chip.draggable = true;
            chip.dataset.category = cat;
            chip.innerHTML = `<span>${cat}</span><span class="chip-count">${count}</span>`;

            chip.addEventListener('click', () => {
                const target = document.getElementById(`group-${cat}`);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    target.style.transition = 'box-shadow 0.3s';
                    target.style.boxShadow = '0 0 0 4px rgba(59,130,246,0.3)';
                    setTimeout(() => target.style.boxShadow = 'none', 800);
                }
            });

            chip.addEventListener('dragstart', () => chip.classList.add('dragging'));
            chip.addEventListener('dragend', () => {
                chip.classList.remove('dragging');
                this.checkAndSaveOrder();
            });
            listContainer.appendChild(chip);
        });

        listContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = this.getDragAfterElement(listContainer, e.clientX);
            const draggable = document.querySelector('.dragging');
            if (draggable) {
                if (afterElement == null) listContainer.appendChild(draggable);
                else listContainer.insertBefore(draggable, afterElement);
            }
        });
    },

    getDragAfterElement(container, x) {
        const draggableElements = [...container.querySelectorAll('.chip-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = x - box.left - box.width / 2;
            if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
            else return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    },

    checkAndSaveOrder() {
        const chips = document.querySelectorAll('#category-chip-list .chip-item');
        const newOrder = Array.from(chips).map(c => c.dataset.category);
        if (JSON.stringify(this.categoryOrder) !== JSON.stringify(newOrder)) {
            this.saveCategoryOrder(newOrder);
        }
    },

    openDetailModal(id) {
        if (!this.detailModal) return;

        const product = this.allProducts.find(p => p.id === id);
        if (!product) return;

        const existingCategories = Array.from(new Set(this.allProducts.map(p => p.category).filter(Boolean)));
        const allCats = Array.from(new Set([...this.categoryOrder, ...existingCategories]));

        this.detailModal.open(
            product, 
            allCats,
            async (updatedData) => {
                await this.handleSingleProductSave(updatedData);
            }
        );
    },

    async handleSingleProductSave(updatedData) {
        try {
            const res = await authedFetch('/api/products/batch', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({products: [updatedData]})
            });

            if(res.success) {
                const idx = this.allProducts.findIndex(p => p.id === updatedData.id);
                if (idx !== -1) {
                    this.allProducts[idx] = { ...this.allProducts[idx], ...updatedData };
                }
                this.renderTable(); 
            } else {
                throw new Error(res.error || 'API Error');
            }
        } catch (e) {
            console.error(e);
            throw e; 
        }
    },

    toggleCost(id) {
        const key = `${id}_cost`;
        if (this.revealedCostIds.has(key)) this.revealedCostIds.delete(key);
        else this.revealedCostIds.add(key);
        this.renderTable();
    },

    // [Fix] 加入 DOM 元素存在性檢查
    setEditMode(active, skipLoad = false) {
        this.isEditMode = active;
        
        const btnEdit = document.getElementById('btn-toggle-edit');
        const btnSave = document.getElementById('btn-save-batch');
        const btnAdd = document.getElementById('btn-add-row');

        if (this.isEditMode) {
            if(btnEdit) {
                btnEdit.textContent = '❌ 取消';
                btnEdit.classList.add('danger');
            }
            if(btnSave) btnSave.style.display = 'inline-block';
            if(btnAdd) btnAdd.style.display = 'inline-block';
            this.renderTable(); 
        } else {
            if(btnEdit) {
                btnEdit.textContent = '✏️ 列表編輯';
                btnEdit.classList.remove('danger');
            }
            if(btnSave) btnSave.style.display = 'none';
            if(btnAdd) btnAdd.style.display = 'none';
            
            if (skipLoad) {
                this.renderTable();
            } else {
                this.loadData();
            }
        }
    },

    addNewRow() {
        const autoId = 'P' + Date.now().toString().slice(-5);
        this.allProducts.unshift({ id: autoId, name: '', category: '未分類', _isNew: true });
        this.renderTable();
    },

    async saveAll() {
        const rows = document.querySelectorAll('.edit-row');
        const payload = [];
        rows.forEach(row => {
            const idx = row.dataset.index;
            const original = this.allProducts[idx] || {};
            const inputs = row.querySelectorAll('input');
            const obj = {};
            inputs.forEach(i => obj[i.name] = i.value.trim());
            if(!obj.id && original.id) obj.id = original.id;
            payload.push({ ...original, ...obj });
        });
        
        if(!payload.length) return;
        if(!confirm(`儲存 ${payload.length} 筆資料?`)) return;

        const overlay = document.getElementById('global-loading-overlay');
        if(overlay) overlay.classList.add('active');

        try {
            const res = await authedFetch('/api/products/batch', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({products: payload})
            });

            if(res.success) {
                const refreshRes = await authedFetch('/api/products');
                if(refreshRes.success) {
                    this.allProducts = refreshRes.data || [];
                }
                this.setEditMode(false, true); // 這裡不會再報錯了
            } else {
                throw new Error(res.error);
            }
        } catch(e) {
            alert('儲存失敗: ' + e.message);
        } finally {
            if(overlay) overlay.classList.remove('active');
        }
    },

    async forceRefresh() {
        const btn = document.getElementById('btn-refresh-products');
        if(btn) btn.textContent = '...';
        await authedFetch('/api/products/refresh', { method: 'POST' });
        await this.loadData();
        if(btn) btn.textContent = '⟳';
    }
};

if (window.CRM_APP) window.CRM_APP.pageModules['products'] = () => ProductManager.init();