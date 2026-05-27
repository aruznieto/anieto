const GITHUB_USER = "aruznieto";
const GITHUB_REPO = "anieto";
const BRANCH = "main";
const ROOT_FOLDER = "publicaciones";

const fileList = document.getElementById("fileList");
const searchInput = document.getElementById("searchInput");

let treeData = [];

async function loadFiles() {
  showStatus("Cargando archivos...");

  try {
    const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/git/trees/${encodeURIComponent(BRANCH)}?recursive=1`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json"
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API respondio con ${response.status}`);
    }

    const data = await response.json();
    const rootItem = data.tree.find((item) => item.path === ROOT_FOLDER);
    const publicationItems = data.tree.filter((item) =>
      item.path.startsWith(`${ROOT_FOLDER}/`)
    );

    if (!rootItem && publicationItems.length === 0) {
      throw new Error(`No existe la carpeta ${ROOT_FOLDER}`);
    }

    treeData = buildTree(publicationItems);
    renderTree(treeData);
  } catch (error) {
    console.error(error);

    fileList.innerHTML = `
      <div class="empty">
        No se pudieron cargar las publicaciones. Comprueba que el repositorio
        <strong>${escapeHtml(`${GITHUB_USER}/${GITHUB_REPO}`)}</strong> sea publico,
        que la rama sea <strong>${escapeHtml(BRANCH)}</strong> y que exista la carpeta
        <strong>${escapeHtml(ROOT_FOLDER)}</strong>.
      </div>
    `;
  }
}

function buildTree(items) {
  const root = [];
  const folders = new Map();

  for (const item of items) {
    const relativePath = item.path.slice(ROOT_FOLDER.length + 1);
    const parts = relativePath.split("/").filter(Boolean);

    if (parts.length === 0) continue;

    let currentLevel = root;
    let currentPath = ROOT_FOLDER;

    for (let index = 0; index < parts.length; index += 1) {
      const name = parts[index];
      const isLast = index === parts.length - 1;
      currentPath = `${currentPath}/${name}`;

      if (isLast && item.type === "blob") {
        if (!currentLevel.some((entry) => entry.path === item.path)) {
          currentLevel.push({
            type: "file",
            name,
            path: item.path,
            url: encodePath(item.path),
            size: item.size || 0
          });
        }
        continue;
      }

      let folder = folders.get(currentPath);

      if (!folder) {
        folder = {
          type: "folder",
          name,
          path: currentPath,
          children: []
        };

        folders.set(currentPath, folder);
        currentLevel.push(folder);
      }

      currentLevel = folder.children;
    }
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
  const normalizedQuery = normalize(query);
  const html = renderItems(data, normalizedQuery, 0);
  const summary = summarizeTree(data);
  const searchStatus = normalizedQuery
    ? `<div class="search-status">Buscando: <strong>${escapeHtml(query)}</strong></div>`
    : "";

  fileList.innerHTML = `
    <div class="summary">
      ${summary.files} archivo${summary.files === 1 ? "" : "s"} en
      ${summary.folders} carpeta${summary.folders === 1 ? "" : "s"}
    </div>
    ${searchStatus}
    ${html || `<div class="empty">No se encontraron publicaciones.</div>`}
  `;
}

function renderItems(items, query = "", level = 0) {
  let html = "";

  for (const item of items) {
    if (item.type === "folder") {
      const folderContent = renderItems(item.children, query, level + 1);
      const folderMatches = matchesQuery(item, query);

      if (query && !folderMatches && !folderContent) continue;

      const summary = summarizeTree(item.children);

      html += `
        <section class="folder" style="--level: ${level}">
          <details open>
            <summary>
              <span class="item-icon" aria-hidden="true">DIR</span>
              <span class="item-title">${escapeHtml(item.name)}</span>
              <span class="folder-meta">
                ${summary.files} archivo${summary.files === 1 ? "" : "s"}
              </span>
            </summary>
            <div class="folder-content">
              ${folderContent || `<div class="empty nested">Carpeta vacia</div>`}
            </div>
          </details>
        </section>
      `;
    }

    if (item.type === "file") {
      if (query && !matchesQuery(item, query)) continue;

      const extension = getExtension(item.name);

      html += `
        <article class="file-card" style="--level: ${level}">
          <div class="file-info">
            <div class="file-name">
              <span class="item-icon" aria-hidden="true">${getIcon(extension)}</span>
              <span>${escapeHtml(item.name)}</span>
            </div>
            <div class="file-meta">
              ${escapeHtml(extension.toUpperCase())} · ${formatBytes(item.size)}
            </div>
          </div>

          <div class="file-actions">
            <a href="${item.url}" target="_blank" rel="noopener">
              Abrir
            </a>
            <a href="${item.url}" download>
              Descargar
            </a>
          </div>
        </article>
      `;
    }
  }

  return html;
}

function summarizeTree(items) {
  return items.reduce(
    (summary, item) => {
      if (item.type === "file") {
        summary.files += 1;
      }

      if (item.type === "folder") {
        const childSummary = summarizeTree(item.children);
        summary.folders += 1 + childSummary.folders;
        summary.files += childSummary.files;
      }

      return summary;
    },
    { files: 0, folders: 0 }
  );
}

function matchesQuery(item, query) {
  if (!query) return true;

  return normalize(item.name).includes(query) || normalize(item.path).includes(query);
}

function normalize(value) {
  return value.toLowerCase().trim();
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
}

function getExtension(filename) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "archivo";
}

function getIcon(extension) {
  const icons = {
    pdf: "PDF",
    doc: "DOC",
    docx: "DOC",
    xls: "XLS",
    xlsx: "XLS",
    csv: "CSV",
    zip: "ZIP",
    rar: "RAR",
    "7z": "7Z",
    png: "IMG",
    jpg: "IMG",
    jpeg: "IMG",
    webp: "IMG",
    gif: "IMG",
    txt: "TXT",
    md: "MD",
    ppt: "PPT",
    pptx: "PPT"
  };

  return icons[extension] || "FILE";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showStatus(message) {
  fileList.innerHTML = `<div class="status">${escapeHtml(message)}</div>`;
}

searchInput.addEventListener("input", () => {
  renderTree(treeData, searchInput.value);
});

loadFiles();
