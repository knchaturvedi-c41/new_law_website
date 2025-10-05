// ======================
// Firebase configuration
// ======================
const firebaseConfig = {
  apiKey: "AIzaSyCUYKPeoDdG_28nYL5jLhfkR2qrOVIYZ9o",
  authDomain: "web-app-a144d.firebaseapp.com",
  projectId: "web-app-a144d",
  storageBucket: "web-app-a144d.appspot.com", // ensure .appspot.com
  messagingSenderId: "380747882951",
  appId: "1:380747882951:web:3a54e0bac13b9c95ee39e2",
  measurementId: "G-D4FLGD3YLH"
};

// (Optional) Show admin controls on works.html only after login
const ADMIN_EMAIL = "YOUR_EMAIL_HERE"; // must match your Firestore/Storage rules

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

const POSTS = db.collection('works_posts');

// Utils
function formatDate(ts) {
  try { const d = ts?.toDate ? ts.toDate() : new Date(ts); return d.toLocaleString(); }
  catch { return ''; }
}
function sanitizeHtml(html) {
  if (!html) return "";
  return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

// Track auth/admin status (used by both pages)
let currentUser = null;
let isAdmin = false;
auth.onAuthStateChanged(user => {
  currentUser = user || null;
  isAdmin = !!(user && user.email && ADMIN_EMAIL && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
  if (typeof window.__renderWorksPage === 'function') window.__renderWorksPage();
  if (typeof window.__renderAdminStrip === 'function') window.__renderAdminStrip();
});

// ======================
// PUBLIC PAGE: works.html
// ======================
(function initPublicPage(){
  const postsContainer = document.getElementById('posts-container');
  if (!postsContainer) return;

  const listEl = document.getElementById('posts-list');
  const emptyEl = document.getElementById('empty-state');
  const currentCategoryEl = document.getElementById('current-category');
  const searchInput = document.getElementById('works-search');
  const tabs = document.querySelectorAll('.category-tab');

  // Optional admin strip
  let adminStrip = document.getElementById('admin-strip');
  if (!adminStrip) {
    adminStrip = document.createElement('div');
    adminStrip.id = 'admin-strip';
    adminStrip.style.cssText = "font-size:13px;margin:4px 0 8px;color:#555;";
    postsContainer.prepend(adminStrip);
  }
  window.__renderAdminStrip = function() {
    if (!adminStrip) return;
    if (isAdmin && currentUser) {
      adminStrip.innerHTML = `Signed in as <strong>${currentUser.email}</strong> · <a href="#" id="ws-signout">Sign out</a>`;
      const signout = document.getElementById('ws-signout');
      if (signout) signout.onclick = async (e) => { e.preventDefault(); await auth.signOut(); };
    } else {
      adminStrip.innerHTML = `Admin: <a href="works-admin.html">Sign in to manage posts</a>`;
    }
  };
  window.__renderAdminStrip();

  let currentCategory = 'All';
  let allPosts = [];

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.setAttribute('aria-selected', 'false'));
      tab.setAttribute('aria-selected', 'true');
      currentCategory = tab.dataset.category;
      if (currentCategoryEl) currentCategoryEl.textContent = currentCategory;
      render();
    });
  });

  if (searchInput) searchInput.addEventListener('input', render);

  function matchesSearch(post) {
    const q = (searchInput?.value || '').trim().toLowerCase();
    if (!q) return true;
    const blob = [post.title, post.category, post.content, (post.tags||[]).join(' ')].join(' ').toLowerCase();
    return blob.includes(q);
  }
  function matchesCategory(post) {
    return currentCategory === 'All' || post.category === currentCategory;
  }

  window.__renderWorksPage = render;

  function render() {
    if (!listEl) return;
    listEl.innerHTML = '';
    const subset = allPosts.filter(p => matchesCategory(p) && matchesSearch(p));
    if (subset.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    subset.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));

    subset.forEach(p => {
      const card = document.createElement('article');
      card.className = 'post-card';
      const adminCtrls = (isAdmin)
        ? `
          <div class="post-actions" style="margin-top:8px;">
            <button class="btn secondary" data-edit="${p.id}" style="margin-right:8px;">Edit</button>
            <button class="btn danger" data-del="${p.id}">Delete</button>
          </div>
        `
        : '';
      card.innerHTML = `
        <h3>${p.title}</h3>
        <div class="post-meta">
          <span>${p.category}</span> • <span>${formatDate(p.createdAt)}</span> • <span>${p.authorEmail||''}</span>
        </div>
        <div class="post-body">${p.content || ''}</div>
        ${p.attachmentUrl ? `<p class="post-actions"><a href="${p.attachmentUrl}" target="_blank" rel="noopener">Open attachment</a></p>` : ''}
        ${adminCtrls}
      `;
      listEl.appendChild(card);
    });
  }

  POSTS.orderBy('createdAt', 'desc').onSnapshot(snap => {
    allPosts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  });

  listEl.addEventListener('click', async (e) => {
    const delBtn = e.target.closest('[data-del]');
    const editBtn = e.target.closest('[data-edit]');

    if (delBtn && isAdmin) {
      const id = delBtn.getAttribute('data-del');
      if (!confirm('Delete this post?')) return;
      try {
        const docRef = POSTS.doc(id);
        const snap = await docRef.get();
        const data = snap.data();
        if (data && data.attachmentUrl) {
          try { await storage.refFromURL(data.attachmentUrl).delete(); }
          catch (err) { console.warn('Attachment delete skipped:', err?.message || err); }
        }
        await docRef.delete();
      } catch (err) {
        console.error(err);
        alert(err.message);
      }
    }

    if (editBtn && isAdmin) {
      const id = editBtn.getAttribute('data-edit');
      sessionStorage.setItem('editPostId', id);
      window.location.href = 'works-admin.html';
    }
  });
})();

// =========================
// ADMIN PAGE: works-admin.html
// =========================
(function initAdminPage(){
  const emailEl = document.getElementById('auth-email');
  const passEl  = document.getElementById('auth-password');
  const btnIn   = document.getElementById('btn-signin');
  const btnOut  = document.getElementById('btn-signout');

  const whenOut = document.getElementById('auth-when-signed-out');
  const whenIn  = document.getElementById('auth-when-signed-in');
  const meEmail = document.getElementById('me-email');

  const editor     = document.getElementById('editor');
  const myPostsBox = document.getElementById('my-posts');
  const myPostsList= document.getElementById('my-posts-list');

  const titleEl   = document.getElementById('post-title');
  const catEl     = document.getElementById('post-category');
  const tagsEl    = document.getElementById('post-tags');
  let   rteEl     = document.getElementById('rte-editor');
  const textFallback = document.getElementById('post-content'); // if you still have a textarea
  const attachEl  = document.getElementById('post-attachment');
  const msgEl     = document.getElementById('editor-message');

  const btnPublish= document.getElementById('btn-publish');
  const btnClear  = document.getElementById('btn-clear');

  // NEW: current attachment UI
  const currentAttachmentBox  = document.getElementById('current-attachment');
  const currentAttachmentLink = document.getElementById('current-attachment-link');
  const btnRemoveAttachment   = document.getElementById('btn-remove-attachment');
  const removedNote           = document.getElementById('attachment-removed-note');
  const btnClearFile          = document.getElementById('btn-clear-file');

  // Track current & removal intent
  let currentAttachmentUrl = null;
  let removeAttachmentFlag = false;

  // Fallback to textarea if RTE not present
  if (!rteEl && textFallback) {
    rteEl = {
      get innerHTML(){ return textFallback.value; },
      set innerHTML(v){ textFallback.value = v; },
      focus(){ textFallback.focus(); }
    };
  }

  // Toolbar logic (if you have toolbar buttons in your HTML)
  function applyCmd(cmd, val=null) {
    if (document.execCommand && rteEl?.focus) {
      document.execCommand(cmd, false, val);
      rteEl.focus();
    }
  }
  document.querySelectorAll('.tool-btn[data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd');
      const val = btn.getAttribute('data-value') || null;
      applyCmd(cmd, val);
    });
  });
  const linkBtn = document.getElementById('link-btn');
  if (linkBtn) {
    linkBtn.addEventListener('click', () => {
      const url = prompt('Enter URL (include https://):');
      if (url) applyCmd('createLink', url);
    });
  }

  if (btnIn) btnIn.addEventListener('click', async () => {
    try { await auth.signInWithEmailAndPassword(emailEl.value, passEl.value); }
    catch (e) { alert(e.message); }
  });

  if (btnOut) btnOut.addEventListener('click', async () => { await auth.signOut(); });

  // Clear only the chosen file (doesn't touch your written content)
  if (btnClearFile) btnClearFile.addEventListener('click', () => {
    if (attachEl) attachEl.value = '';
  });

  // Mark current attachment for removal (deletes on Publish)
  if (btnRemoveAttachment) btnRemoveAttachment.addEventListener('click', () => {
    removeAttachmentFlag = true;
    if (removedNote) removedNote.style.display = 'inline';
    if (currentAttachmentLink) currentAttachmentLink.style.textDecoration = 'line-through';
  });

  auth.onAuthStateChanged(user => {
    if (user) {
      whenOut.style.display = 'none';
      whenIn.style.display  = 'block';
      editor.style.display  = 'block';
      myPostsBox.style.display = 'block';
      meEmail.textContent = user.email || '(no email)';

      // Load my recent posts (index-free variant)
      POSTS.orderBy('createdAt','desc').limit(100).onSnapshot(snap => {
        myPostsList.innerHTML = '';
        const mine = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.authorUid === user.uid);

        if (mine.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'small';
          empty.textContent = 'No posts yet.';
          myPostsList.appendChild(empty);
          return;
        }

        mine.forEach(p => {
          const row = document.createElement('div');
          row.className = 'post-list-item';
          row.innerHTML = `
            <div>
              <div class="title">${p.title}</div>
              <div class="meta">${p.category} • ${formatDate(p.createdAt)}</div>
            </div>
            <div>
              <button class="btn secondary" data-edit="${p.id}">Edit</button>
              <button class="btn danger" data-del="${p.id}">Delete</button>
            </div>
          `;
          myPostsList.appendChild(row);
        });

        // Delete (also removes attachment if present)
        myPostsList.querySelectorAll('[data-del]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-del');
            if (!confirm('Delete this post?')) return;
            try {
              const docRef = POSTS.doc(id);
              const snap = await docRef.get();
              const data = snap.data();
              if (data && data.attachmentUrl) {
                try { await storage.refFromURL(data.attachmentUrl).delete(); }
                catch (e) { console.warn('Attachment delete skipped:', e?.message || e); }
              }
              await docRef.delete();
            } catch (e) { console.error(e); alert(e.message); }
          });
        });

        // Edit: load into editor (and show current attachment)
        myPostsList.querySelectorAll('[data-edit]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-edit');
            const doc = await POSTS.doc(id).get();
            if (doc.exists) {
              const p = doc.data();
              titleEl.value = p.title || '';
              catEl.value   = p.category || 'Legislative Drafting';
              tagsEl.value  = (p.tags||[]).join(', ');
              rteEl.innerHTML = p.content || '';
              msgEl.textContent = 'Loaded post. Edit fields and click Publish to update.';
              editor.dataset.editing = id;

              // show current attachment UI
              currentAttachmentUrl = p.attachmentUrl || null;
              removeAttachmentFlag = false;
              if (currentAttachmentUrl) {
                currentAttachmentBox.style.display = 'block';
                currentAttachmentLink.href = currentAttachmentUrl;
                currentAttachmentLink.textContent = 'Open';
                currentAttachmentLink.style.textDecoration = 'none';
                removedNote.style.display = 'none';
              } else {
                currentAttachmentBox.style.display = 'none';
              }

              window.scrollTo({ top: editor.offsetTop - 80, behavior: 'smooth' });
            }
          });
        });
      });

      // If redirected from works.html with an edit request
      const editId = sessionStorage.getItem('editPostId');
      if (editId) {
        sessionStorage.removeItem('editPostId');
        POSTS.doc(editId).get().then(doc => {
          if (doc.exists) {
            const p = doc.data();
            titleEl.value = p.title || '';
            catEl.value   = p.category || 'Legislative Drafting';
            tagsEl.value  = (p.tags||[]).join(', ');
            rteEl.innerHTML = p.content || '';
            msgEl.textContent = 'Loaded post from Works page. Edit and Publish to update.';
            editor.dataset.editing = editId;

            currentAttachmentUrl = p.attachmentUrl || null;
            removeAttachmentFlag = false;
            if (currentAttachmentUrl) {
              currentAttachmentBox.style.display = 'block';
              currentAttachmentLink.href = currentAttachmentUrl;
              currentAttachmentLink.textContent = 'Open';
              currentAttachmentLink.style.textDecoration = 'none';
              removedNote.style.display = 'none';
            } else {
              currentAttachmentBox.style.display = 'none';
            }

            window.scrollTo({ top: editor.offsetTop - 80, behavior: 'smooth' });
          }
        });
      }

    } else {
      whenOut.style.display = 'block';
      whenIn.style.display  = 'none';
      editor.style.display  = 'none';
      myPostsBox.style.display = 'none';
      meEmail.textContent = '';
    }
  });

  async function maybeUploadAttachment(user) {
    const file = attachEl?.files?.[0];
    if (!file) return null;
    const ext = file.name.split('.').pop();
    const path = `attachments/${user.uid}/${Date.now()}.${ext}`;
    const ref = storage.ref().child(path);
    await ref.put(file);
    return await ref.getDownloadURL();
  }

  async function publish() {
    const user = auth.currentUser;
    if (!user) return alert('Please sign in first.');

    const now = firebase.firestore.FieldValue.serverTimestamp();
    const title = (titleEl.value || '').trim();
    const category = catEl.value;
    const tags = (tagsEl.value || '').split(',').map(s => s.trim()).filter(Boolean);
    const content = sanitizeHtml(rteEl?.innerHTML || '');

    if (!title) return alert('Title is required.');
    if (!content || content.replace(/<[^>]+>/g, '').trim().length === 0) {
      return alert('Content is empty.');
    }

    msgEl.textContent = 'Uploading…';
    let newAttachmentUrl = null;

    // If a new file is selected, upload it
    try {
      newAttachmentUrl = await maybeUploadAttachment(user);
    } catch (e) {
      console.warn('Attachment upload failed:', e);
    }

    // Decide final attachment URL based on user actions
    let finalAttachmentUrl = currentAttachmentUrl; // default: keep existing
    if (removeAttachmentFlag) {
      // delete existing file (if any) and clear
      if (currentAttachmentUrl) {
        try { await storage.refFromURL(currentAttachmentUrl).delete(); }
        catch (e) { console.warn('Attachment delete skipped:', e?.message || e); }
      }
      finalAttachmentUrl = null;
    }
    // If a new file was uploaded, it replaces whatever was there
    if (newAttachmentUrl) {
      finalAttachmentUrl = newAttachmentUrl;
    }

    const docIdEditing = editor.dataset.editing;
    const payload = {
      title, category, tags, content,
      attachmentUrl: finalAttachmentUrl || null,
      authorUid: user.uid,
      authorEmail: user.email || null,
      updatedAt: now,
    };

    try {
      if (docIdEditing) {
        await POSTS.doc(docIdEditing).update(payload);
        msgEl.textContent = 'Updated!';
        editor.dataset.editing = '';

        // Reset attachment UI state
        currentAttachmentUrl = finalAttachmentUrl;
        removeAttachmentFlag = false;
        if (currentAttachmentUrl) {
          currentAttachmentBox.style.display = 'block';
          currentAttachmentLink.href = currentAttachmentUrl;
          currentAttachmentLink.textContent = 'Open';
          currentAttachmentLink.style.textDecoration = 'none';
          removedNote.style.display = 'none';
        } else {
          currentAttachmentBox.style.display = 'none';
        }

      } else {
        await POSTS.add({ ...payload, createdAt: now });
        msgEl.textContent = 'Published!';
        // Clear only what makes sense; keep the text if you prefer
        // titleEl.value = '';
        // tagsEl.value = '';
        // rteEl.innerHTML = '';
        attachEl.value = '';
        currentAttachmentUrl = null;
        removeAttachmentFlag = false;
        currentAttachmentBox.style.display = 'none';
      }
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  }

  if (btnPublish) btnPublish.addEventListener('click', publish);
  if (btnClear) btnClear.addEventListener('click', () => {
    titleEl.value = '';
    tagsEl.value = '';
    rteEl.innerHTML = '';
    attachEl.value = '';
    editor.dataset.editing = '';
    msgEl.textContent = 'Cleared.';
    currentAttachmentUrl = null;
    removeAttachmentFlag = false;
    if (currentAttachmentBox) currentAttachmentBox.style.display = 'none';
  });
})();
