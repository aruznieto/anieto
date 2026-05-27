const GITHUB_USER = "aruznieto";
const GITHUB_REPO = "anieto";
const BRANCH = "main";
const ROOT_FOLDER = "publicaciones";

const fileList = document.getElementById("fileList");
const searchInput = document.getElementById("searchInput");

let treeData = [];

async function loadFiles() {
  try {
    fileList.innerHTML = `<div class="status">Cargando archivos...</div>`;

    const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/git/trees/${BRANCH}?recursive=1`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error("No se pudo cargar el árbol del repositorio");
    }

    const data = await response.json();

    treeData = buildTree(data.tree);
    renderTree(treeData);

  } catch (error) {
    fileList.innerHTML = `
      <div class="empty">
        No se pudieron cargar los archivos. Comprueba que el repositorio sea público,
        que la rama sea <strong>${BRANCH}</strong> y que exista la carpeta 
        <strong>${ROOT_FOLDER}</strong>.
      </div>
    `;
  }
}

function buildTree(items) {
  const root = [];

  const filteredItems = items.filter(item =>
    item.path === ROOT_FOLDER || item.path.startsWith(`${ROOT_FOLDER}/`)
  );

  for (const item of filteredItems) {
    if (item.path === ROOT_FOLDER) continue;

    const relativePath = item.path.replace(`${ROOT_FOLDER}/`, "");
    const parts = relativePath.split("/");

    let currentLevel = root;

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;

      if (isLast && item.type === "blob") {
        currentLevel.push({
          type: "file",
          name: part,
          path: item.path,
          size: item.size || 0,
          downloadUrl: `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${BRANCH}/${encodeURI(item.path)}`
        });
      } else {
        let folder = currentLevel.find(
          entry => entry.type === "folder" && entry.name === part
        );

        if (!folder) {
          folder = {
            type: "folder",
            name: part,
            path: parts.slice(0, index + 1).join("/"),
            children: []
          };

          currentLevel.push(folder);
        }

        currentLevel = folder.children;
      }
    });
  }

  sortTree(root);
  return root;
}

function sortTree(items) {
  items.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "folder" ? -1 : 1;
    }

    return a.name.localeCompare(b.name, "es", {
      sensitivity: "base",
      numeric: true
    });
  });

  for (const item of items) {
    if (item.type === "folder") {
      sortTree(item.children);
    }
  }
}

function renderTree(data, query = "") {
  const normalizedQuery = query.toLowerCase().trim();
  const html = renderItems(data, normalizedQuery, 0);

  const searchStatus = normalizedQuery
    ? `<div class="search-status">Buscando: <strong>${escapeHtml(query)}</strong></div>`
    : "";

  fileList.innerHTML = `
    ${searchStatus}
    ${html || `<div class="empty">No se encontraron archivos.</div>`}
  `;
}

function renderItems(items, query = "", level = 0) {
  let html = "";

  for (const item of items) {
    if (item.type === "folder") {
      const folderContent = renderItems(item.children, query, level + 1);
      const folderMatches = item.name.toLowerCase().includes(query);

      if (query && !folderMatches && !folderContent) {
        continue;
      }

      html += `
        <section class="folder" style="margin-left: ${level * 18}px">
          <details open>
            <summary>
              <span class="folder-icon">📁</span>
              <span>${escapeHtml(item.name)}</span>
            </summary>
            <div class="folder-content">
              ${folderContent}
            </div>
          </details>
        </section>
      `;
    }

    if (item.type === "file") {
      const fileMatches = item.name.toLowerCase().includes(query);

      if (query && !fileMatches) {
        continue;
      }

      const extension = getExtension(item.name);

      html += `
        <article class="file-card" style="margin-left: ${level * 18}px">
          <div class="file-info">
            <div class="file-name">
              ${getIcon(extension)} ${escapeHtml(item.name)}
            </div>
            <div class="file-meta">
              ${extension.toUpperCase()} · ${formatBytes(item.size)}
            </div>
          </div>

          <div class="file-actions">
            <a href="${item.downloadUrl}" target="_blank" rel="noopener">
              Descargar
            </a>
          </div>
        </article>
      `;
    }
  }

  return html;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
}

function getExtension(filename) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "archivo";
}

function getIcon(extension) {
  const icons = {
    pdf: "📄",
    doc: "📝",
    docx: "📝",
    xls: "📊",
    xlsx: "📊",
    csv: "📊",
    zip: "🗜️",
    rar: "🗜️",
    "7z": "🗜️",
    png: "🖼️",
    jpg: "🖼️",
    jpeg: "🖼️",
    webp: "🖼️",
    gif: "🖼️",
    txt: "📃",
    md: "📃",
    ppt: "📽️",
    pptx: "📽️"
  };

  return icons[extension] || "📁";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim();

  if (!treeData) return;

  renderTree(treeData, query);
});

loadFiles();