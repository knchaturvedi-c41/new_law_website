// ======================
// Firebase configuration
// ======================
// 1) Create a Firebase project at https://console.firebase.google.com
// 2) Enable Authentication (Email/Password), Firestore, and Storage
// 3) Replace the config object below with YOUR project's values
// 4) (Optional) Restrict sign-up to only specific admins in Firebase Auth settings
// 5) Set Firestore Security Rules to allow read for all and write only for authenticated users (see rules at bottom)

// ---- REPLACE THIS BLOCK WITH YOUR OWN FIREBASE CONFIG ----
const firebaseConfig = {
  apiKey: "AIzaSyCUYKPeoDdG_28nYL5jLhfkR2qrOVIYZ9o",
  authDomain: "web-app-a144d.firebaseapp.com",
  projectId: "web-app-a144d",
  storageBucket: "web-app-a144d.firebasestorage.app",
  messagingSenderId: "380747882951",
  appId: "1:380747882951:web:3a54e0bac13b9c95ee39e2",
  measurementId: "G-D4FLGD3YLH"
};
// ----------------------------------------------------------

// Initialize
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Collections
const POSTS = db.collection('works_posts');

// Utility: format date
function formatDate(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  } catch {
    return '';
  }
}

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

  let currentCategory = 'All';
  let allPosts = [];

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.setAttribute('aria-selected', 'false'));
      tab.setAttribute('aria-selected', 'true');
      currentCategory = tab.dataset.category;
      currentCategoryEl.textContent = currentCategory;
      render();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', render);
  }

  function matchesSearch(post) {
    const q = (searchInput?.value || '').trim().toLowerCase();
    if (!q) return true;
    const blob = [post.title, post.category, post.content, (post.tags||[]).join(' ')].join(' ').toLowerCase();
    return blob.includes(q);
  }

  function matchesCategory(post) {
    return currentCategory === 'All' || post.category === currentCategory;
  }

  function render() {
    listEl.innerHTML = '';
    const subset = allPosts.filter(p => matchesCategory(p) && matchesSearch(p));
    if (subset.length === 0) {
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';
    subset.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
    subset.forEach(p => {
      const card = document.createElement('article');
      card.className = 'post-card';
      card.innerHTML = `
        <h3>${p.title}</h3>
        <div class="post-meta">
          <span>${p.category}</span> • <span>${formatDate(p.createdAt)}</span> • <span>${p.authorEmail||''}</span>
        </div>
        <div class="post-body">${p.content || ''}</div>
        ${p.attachmentUrl ? `<p class="post-actions"><a href="${p.attachmentUrl}" target="_blank" rel="noopener">Open attachment</a></p>` : ''}
      `;
      listEl.appendChild(card);
    });
  }

  // Live updates
  POSTS.orderBy('createdAt', 'desc').onSnapshot(snap => {
    allPosts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  });
})();

// =========================
// ADMIN PAGE: works-admin.html
// =========================
(function initAdminPage(){
  const emailEl = document.getElementById('auth-email');
  const passEl  = document.getElementById('auth-password');
  const btnIn   = document.getElementById('btn-signin');
  const btnUp   = document.getElementById('btn-signup');
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
  const contentEl = document.getElementById('post-content');
  const attachEl  = document.getElementById('post-attachment');
  const msgEl     = document.getElementById('editor-message');

  const btnPublish= document.getElementById('btn-publish');
  const btnClear  = document.getElementById('btn-clear');

  if (btnIn) btnIn.addEventListener('click', async () => {
    try {
      await auth.signInWithEmailAndPassword(emailEl.value, passEl.value);
    } catch (e) {
      alert(e.message);
    }
  });

  if (btnUp) btnUp.addEventListener('click', async () => {
    try {
      await auth.createUserWithEmailAndPassword(emailEl.value, passEl.value);
    } catch (e) {
      alert(e.message);
    }
  });

  if (btnOut) btnOut.addEventListener('click', async () => {
    await auth.signOut();
  });

  auth.onAuthStateChanged(user => {
    if (user) {
      whenOut.style.display = 'none';
      whenIn.style.display  = 'block';
      editor.style.display  = 'block';
      myPostsBox.style.display = 'block';
      meEmail.textContent = user.email || '(no email)';

      // Load my recent posts
      POSTS.where('authorUid','==',user.uid).orderBy('createdAt','desc').limit(25).onSnapshot(snap => {
        myPostsList.innerHTML = '';
        snap.forEach(doc => {
          const p = { id: doc.id, ...doc.data() };
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

        // Wire buttons
        myPostsList.querySelectorAll('[data-del]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-del');
            if (confirm('Delete this post?')) {
              await POSTS.doc(id).delete();
            }
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
              contentEl.value = p.content || '';
              msgEl.textContent = 'Loaded post. Edit fields and click Publish to update.';
              // Store current editing id
              editor.dataset.editing = id;
              window.scrollTo({ top: editor.offsetTop - 80, behavior: 'smooth' });
            }
          });
        });
      });
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
    const content = contentEl.value;

    if (!title) return alert('Title is required.');

    msgEl.textContent = 'Uploading…';
    let attachmentUrl = null;
    try {
      attachmentUrl = await maybeUploadAttachment(user);
    } catch (e) {
      console.warn('Attachment upload failed:', e);
    }

    const docIdEditing = editor.dataset.editing;
    const payload = {
      title,
      category,
      tags,
      content,
      attachmentUrl: attachmentUrl || null,
      authorUid: user.uid,
      authorEmail: user.email || null,
      updatedAt: now,
    };

    try {
      if (docIdEditing) {
        await POSTS.doc(docIdEditing).update(payload);
        msgEl.textContent = 'Updated!';
        editor.dataset.editing = '';
      } else {
        await POSTS.add({ ...payload, createdAt: now });
        msgEl.textContent = 'Published!';
      }
      // clear inputs (not attachment for convenience)
      // titleEl.value = '';
      // contentEl.value = '';
      // tagsEl.value = '';
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  }

  if (btnPublish) btnPublish.addEventListener('click', publish);
  if (btnClear) btnClear.addEventListener('click', () => {
    titleEl.value = '';
    tagsEl.value = '';
    contentEl.value = '';
    attachEl.value = '';
    editor.dataset.editing = '';
    msgEl.textContent = 'Cleared.';
  });
})();

// ======================
// Firestore Security Rules (example)
// ======================
// In Firebase console -> Firestore -> Rules, you can use something like:
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /works_posts/{docId} {
      allow read: if true; // public read
      allow create, update, delete: if request.auth != null; // only signed-in users
    }
  }
}
*/
