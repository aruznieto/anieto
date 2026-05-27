const GITHUB_USER = "aruznieto";
const GITHUB_REPO = "anieto";
const ROOT_FOLDER = "publicaciones";

const fileList = document.getElementById("fileList");
const searchInput = document.getElementById("searchInput");

let treeData = null;

async function fetchFolder(path) {
  const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${path}`;

  const response = await fetch(apiUrl);

  if (!response.ok) {
    throw new Error(`No se pudo cargar la carpeta: ${path}`);
  }

  const items = await response.json();

  const folders = items
    .filter(item => item.type === "dir")
    .sort((a, b) => a.name.localeCompare(b.name));

  const files = items
    .filter(item => item.type === "file")
    .sort((a, b) => a.name.localeCompare(b.name));

  const children = [];

  for (const folder of folders) {
    const folderChildren = await fetchFolder(folder.path);

    children.push({
      type: "folder",
      name: folder.name,
      path: folder.path,
      children: folderChildren
    });
  }

  for (const file of files) {
    children.push({
      type: "file",
      name: file.name,
      path: file.path,
      size: file.size,
      downloadUrl: file.download_url
    });
  }

  return children;
}

async function loadFiles() {
  try {
    fileList.innerHTML = `<p>Cargando archivos...</p>`;

    treeData = await fetchFolder(ROOT_FOLDER);

    renderTree(treeData);
  } catch (error) {
    fileList.innerHTML = `
      <div class="empty">
        No se pudieron cargar los archivos. Comprueba que el repositorio sea público
        y que exista la carpeta <strong>${ROOT_FOLDER}</strong>.
      </div>
    `;
  }
}

function renderTree(data, query = "") {
  const html = renderItems(data, query);

  fileList.innerHTML = html || `
    <div class="empty">
      No se encontraron archivos.
    </div>
  `;
}

function renderItems(items, query = "", level = 0) {
  let html = "";

  for (const item of items) {
    if (item.type === "folder") {
      const folderContent = renderItems(item.children, query, level + 1);

      const folderMatches = item.name.toLowerCase().includes(query.toLowerCase());

      if (query && !folderMatches && !folderContent) {
        continue;
      }

      html += `
        <section class="folder" style="margin-left: ${level * 18}px">
          <details open>
            <summary>
              📁 ${escapeHtml(item.name)}
            </summary>
            <div class="folder-content">
              ${folderContent}
            </div>
          </details>
        </section>
      `;
    }

    if (item.type === "file") {
      const fileMatches = item.name.toLowerCase().includes(query.toLowerCase());

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
  if (bytes === 0) return "0 B";

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