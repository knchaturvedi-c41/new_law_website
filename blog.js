// ======================
// Firebase configuration
// ======================
const firebaseConfig = {
  apiKey: "AIzaSyCUYKPeoDdG_28nYL5jLhfkR2qrOVIYZ9o",
  authDomain: "web-app-a144d.firebaseapp.com",
  projectId: "web-app-a144d",
  storageBucket: "web-app-a144d.appspot.com", // harmless to keep
  messagingSenderId: "380747882951",
  appId: "1:380747882951:web:3a54e0bac13b9c95ee39e2",
  measurementId: "G-D4FLGD3YLH"
};

// ===== Admin email used to show Edit/Delete on public page =====
const ADMIN_EMAIL = "chaturvedi.kn@gmail.com";

// Initialize (compat)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

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

// Track auth/admin status shared by both pages
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

  // Tiny admin strip
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
        await POSTS.doc(id).delete();
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
/* ADMIN PAGE: works-admin.html */
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
  const textFallback = document.getElementById('post-content'); // if present
  const msgEl     = document.getElementById('editor-message');

  const btnPublish= document.getElementById('btn-publish');
  const btnClear  = document.getElementById('btn-clear');

  // Fallback to textarea if RTE not present
  if (!rteEl && textFallback) {
    rteEl = {
      get innerHTML(){ return textFallback.value; },
      set innerHTML(v){ textFallback.value = v; },
      focus(){ textFallback.focus(); }
    };
  }

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

  auth.onAuthStateChanged(user => {
    if (user) {
      whenOut.style.display = 'none';
      whenIn.style.display  = 'block';
      editor.style.display  = 'block';
      myPostsBox.style.display = 'block';
      meEmail.textContent = user.email || '(no email)';

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

        myPostsList.querySelectorAll('[data-del]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-del');
            if (!confirm('Delete this post?')) return;
            try {
              await POSTS.doc(id).delete();
            } catch (e) { console.error(e); alert(e.message); }
          });
        });

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

  // ---------- Publish (no attachments) ----------
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

    const docIdEditing = editor.dataset.editing;
    const payload = {
      title, category, tags, content,
      attachmentUrl: null,
      authorUid: user.uid,
      authorEmail: user.email || null,
      updatedAt: now,
    };

    try {
      if (docIdEditing) {
        await POSTS.doc(docIdEditing).update(payload);
        document.getElementById('editor-message').textContent = 'Updated!';
        editor.dataset.editing = '';
      } else {
        await POSTS.add({ ...payload, createdAt: now });
        document.getElementById('editor-message').textContent = 'Published!';
      }
      // Redirect to public page
      setTimeout(() => { window.location.href = 'works.html'; }, 600);
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
    editor.dataset.editing = '';
    const msg = document.getElementById('editor-message');
    if (msg) msg.textContent = 'Cleared.';
  });
})();
