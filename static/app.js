/**
 * Simple Social – auth tabs, login/register, feed, upload
 */

const AUTH_TOKEN_KEY = "simple_social_token";

function getToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function setToken(token) {
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  else localStorage.removeItem(AUTH_TOKEN_KEY);
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ----- Auth screen: tab switching -----
const authScreen = document.getElementById("auth-screen");
const feedScreen = document.getElementById("feed-screen");
const tabs = document.querySelectorAll(".auth-tabs .tab");
const loginFormEl = document.getElementById("login-form");
const registerFormEl = document.getElementById("register-form");
const authError = document.getElementById("auth-error");
const registerError = document.getElementById("register-error");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.getAttribute("data-tab");
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    if (target === "login") {
      loginFormEl.classList.remove("hidden");
      registerFormEl.classList.add("hidden");
      authError.textContent = "";
      registerError.textContent = "";
    } else {
      loginFormEl.classList.add("hidden");
      registerFormEl.classList.remove("hidden");
      authError.textContent = "";
      registerError.textContent = "";
    }
  });
});

// ----- Login -----
loginFormEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  const formData = new URLSearchParams();
  formData.append("username", email);
  formData.append("password", password);

  try {
    const res = await fetch("/auth/jwt/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      authError.textContent = data.detail?.msg || data.detail || "Login failed.";
      return;
    }
    if (data.access_token) {
      setToken(data.access_token);
      showFeed();
    } else {
      authError.textContent = "Invalid response from server.";
    }
  } catch (err) {
    authError.textContent = "Network error. Try again.";
  }
});

// ----- Register -----
registerFormEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  registerError.textContent = "";
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value;

  try {
    const res = await fetch("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.detail?.msg || (Array.isArray(data.detail) ? data.detail.map((d) => d.msg).join(" ") : data.detail) || "Registration failed.";
      registerError.textContent = typeof msg === "string" ? msg : JSON.stringify(msg);
      return;
    }
    // Auto-login after register
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);
    const loginRes = await fetch("/auth/jwt/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });
    const loginData = await loginRes.json().catch(() => ({}));
    if (loginRes.ok && loginData.access_token) {
      setToken(loginData.access_token);
      showFeed();
    } else {
      registerError.textContent = "Account created. Please log in.";
      tabs.forEach((t) => t.classList.remove("active"));
      document.querySelector('.auth-tabs .tab[data-tab="login"]').classList.add("active");
      registerFormEl.classList.add("hidden");
      loginFormEl.classList.remove("hidden");
    }
  } catch (err) {
    registerError.textContent = "Network error. Try again.";
  }
});

// ----- Show auth vs feed -----
function showAuth() {
  authScreen.classList.remove("hidden");
  feedScreen.classList.add("hidden");
}

function showFeed() {
  authScreen.classList.add("hidden");
  feedScreen.classList.remove("hidden");
  loadFeed();
}

// ----- Feed -----
const feedLoading = document.getElementById("feed-loading");
const feedEmpty = document.getElementById("feed-empty");
const feedList = document.getElementById("feed-list");

async function loadFeed() {
  feedList.innerHTML = "";
  feedLoading.classList.remove("hidden");
  feedEmpty.classList.add("hidden");

  try {
    const res = await fetch("/feed", { headers: authHeaders() });
    if (res.status === 401) {
      setToken(null);
      showAuth();
      return;
    }
    const data = await res.json();
    feedLoading.classList.add("hidden");
    const posts = data.posts || [];
    if (posts.length === 0) {
      feedEmpty.classList.remove("hidden");
      return;
    }
    posts.forEach((post) => {
      const card = document.createElement("article");
      card.className = "post-card";
      const media = post.file_type === "video" ? "video" : "img";
      const mediaEl =
        media === "video"
          ? `<video class="post-media video" src="${escapeHtml(post.url)}" controls></video>`
          : `<img class="post-media" src="${escapeHtml(post.url)}" alt="Post" />`;
      card.innerHTML =
        `${mediaEl}` +
        `<div class="post-body">` +
        `<div class="post-meta"><span class="post-author">${escapeHtml(post.user_email)}</span><span class="post-time">${formatTime(post.created_at)}</span></div>` +
        (post.caption ? `<p class="post-caption">${escapeHtml(post.caption)}</p>` : "") +
        (post.is_owner ? `<div class="post-actions"><button type="button" class="btn btn-danger btn-delete" data-id="${escapeHtml(post.id)}">Delete</button></div>` : "") +
        `</div>`;
      const delBtn = card.querySelector(".btn-delete");
      if (delBtn) {
        delBtn.addEventListener("click", () => deletePost(post.id, card));
      }
      feedList.appendChild(card);
    });
  } catch (err) {
    feedLoading.classList.add("hidden");
    feedEmpty.textContent = "Failed to load feed.";
    feedEmpty.classList.remove("hidden");
  }
}

function escapeHtml(s) {
  if (s == null) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

async function deletePost(id, cardEl) {
  try {
    const res = await fetch(`/posts/${id}`, { method: "DELETE", headers: authHeaders() });
    if (res.ok) cardEl.remove();
  } catch (_) {}
}

// ----- Logout -----
document.getElementById("logout-btn").addEventListener("click", () => {
  setToken(null);
  showAuth();
});

// ----- New post modal -----
const uploadModal = document.getElementById("upload-modal");
const uploadForm = document.getElementById("upload-form");
const uploadCancel = document.getElementById("upload-cancel");
const uploadModalBackdrop = document.getElementById("upload-modal-backdrop");
const uploadError = document.getElementById("upload-error");

document.getElementById("new-post-btn").addEventListener("click", () => {
  uploadModal.classList.remove("hidden");
  uploadForm.reset();
  uploadError.textContent = "";
});

function closeUploadModal() {
  uploadModal.classList.add("hidden");
}

uploadCancel.addEventListener("click", closeUploadModal);
uploadModalBackdrop.addEventListener("click", closeUploadModal);

uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  uploadError.textContent = "";
  const fileInput = document.getElementById("post-file");
  const caption = document.getElementById("post-caption").value.trim();
  if (!fileInput.files?.length) {
    uploadError.textContent = "Please choose an image or video.";
    return;
  }
  const formData = new FormData();
  formData.append("file", fileInput.files[0]);
  formData.append("caption", caption);
  try {
    const res = await fetch("/upload", {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      uploadError.textContent = data.detail || "Upload failed.";
      return;
    }
    closeUploadModal();
    loadFeed();
  } catch (err) {
    uploadError.textContent = "Network error. Try again.";
  }
});

// ----- Init: show feed if logged in -----
if (getToken()) {
  showFeed();
} else {
  showAuth();
}
