const GITHUB_USER = "aruznieto";
const GITHUB_REPO = "anieto";
const BRANCH = "main";
const ROOT_FOLDER_CANDIDATES = ["Publicaciones", "publicaciones"];

const fileList = document.getElementById("fileList");
const pathBar = document.getElementById("pathBar");
const searchInput = document.getElementById("searchInput");

let treeData = [];
let currentPath = [];
let rootFolder = ROOT_FOLDER_CANDIDATES[0];

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
    rootFolder = getRootFolder(data.tree);
    const rootItem = data.tree.find((item) => item.path === rootFolder);
    const publicationItems = data.tree.filter((item) =>
      item.path.startsWith(`${rootFolder}/`)
    );

    if (!rootItem && publicationItems.length === 0) {
      throw new Error(`No existe la carpeta ${rootFolder}`);
    }

    treeData = buildTree(publicationItems);
    renderCurrentFolder();
  } catch (error) {
    console.error(error);

    fileList.innerHTML = `
      <div class="empty">
        No se pudieron cargar las publicaciones. Comprueba que el repositorio
        <strong>${escapeHtml(`${GITHUB_USER}/${GITHUB_REPO}`)}</strong> sea publico,
        que la rama sea <strong>${escapeHtml(BRANCH)}</strong> y que exista la carpeta
        <strong>${escapeHtml(ROOT_FOLDER_CANDIDATES.join(" o "))}</strong>.
      </div>
    `;
  }
}

function getRootFolder(items) {
  return (
    ROOT_FOLDER_CANDIDATES.find((candidate) =>
      items.some(
        (item) => item.path === candidate || item.path.startsWith(`${candidate}/`)
      )
    ) || ROOT_FOLDER_CANDIDATES[0]
  );
}

function buildTree(items) {
  const root = [];
  const folders = new Map();

  for (const item of items) {
    const relativePath = item.path.slice(rootFolder.length + 1);
    const parts = relativePath.split("/").filter(Boolean);

    if (parts.length === 0) continue;

    let currentLevel = root;
    let currentPath = rootFolder;

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

function renderCurrentFolder() {
  const query = searchInput.value;

  if (normalize(query)) {
    renderSearchResults(query);
    return;
  }

  renderFolder(getCurrentItems());
}

function getCurrentItems() {
  let items = treeData;

  for (const segment of currentPath) {
    const folder = items.find(
      (item) => item.type === "folder" && item.name === segment
    );

    if (!folder) {
      currentPath = [];
      return treeData;
    }

    items = folder.children;
  }

  return items;
}

function renderFolder(data) {
  const html = renderItems(data);
  renderPathBar();

  fileList.innerHTML = renderDocumentTable(
    html,
    "No hay publicaciones en esta carpeta."
  );
}

function renderSearchResults(query) {
  const normalizedQuery = normalize(query);
  const files = getAllFiles(treeData).filter((item) =>
    matchesQuery(item, normalizedQuery)
  );
  const html = files.map((item) => renderFile(item, true)).join("");
  renderPathBar();

  fileList.innerHTML = renderDocumentTable(
    html,
    "No se encontraron publicaciones.",
    `Buscando en publicaciones: <strong>${escapeHtml(query)}</strong>`
  );
}

function renderPathBar() {
  pathBar.innerHTML = renderBreadcrumbs();
}

function renderBreadcrumbs() {
  const crumbs = [rootFolder, ...currentPath];

  return crumbs
    .map((crumb, index) => {
      const isLast = index === crumbs.length - 1;
      const path = index === 0 ? "" : currentPath.slice(0, index).join("/");
      const label = index === 0 ? "Raíz" : crumb;

      if (isLast) {
        return `
          <span class="breadcrumb-current" aria-current="page">
            ${index === 0 ? '<i class="bi bi-house-door" aria-hidden="true"></i>' : ""}
            ${escapeHtml(label)}
          </span>
        `;
      }

      return `
        <button class="breadcrumb-button" type="button" data-action="breadcrumb" data-path="${escapeHtml(path)}">
          ${index === 0 ? '<i class="bi bi-house-door" aria-hidden="true"></i>' : ""}
          ${escapeHtml(label)}
        </button>
      `;
    })
    .join('<i class="bi bi-chevron-right separator" aria-hidden="true"></i>');
}

function renderDocumentTable(rows, emptyText, status = "") {
  return `
    ${status ? `<div class="search-status">${status}</div>` : ""}
    <div class="table-responsive">
      <table class="document-table">
        <thead>
          <tr>
            <th scope="col">Nombre</th>
            <th scope="col">Tamaño</th>
            <th scope="col" class="actions-heading">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="3"><div class="empty">${escapeHtml(emptyText)}</div></td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function renderItems(items) {
  let html = "";

  for (const item of items) {
    if (item.type === "folder") {
      const summary = summarizeTree(item.children);

      html += `
        <tr class="document-row folder-row" data-row-action="open-folder" data-name="${escapeAttribute(item.name)}">
          <td>
            <button class="entry-button" type="button" data-action="open-folder" data-name="${escapeAttribute(item.name)}">
              <span class="icon-tile folder-tile" aria-hidden="true">
                <i class="bi bi-folder"></i>
              </span>
              <span>
                <span class="entry-name">${escapeHtml(item.name)}</span>
                <span class="entry-detail">${summary.files} archivo${summary.files === 1 ? "" : "s"}</span>
              </span>
            </button>
          </td>
          <td class="muted-cell">-</td>
          <td class="row-actions">
            <button class="icon-action" type="button" data-action="open-folder" data-name="${escapeAttribute(item.name)}" aria-label="Abrir ${escapeAttribute(item.name)}">
              <i class="bi bi-arrow-right"></i>
            </button>
          </td>
        </tr>
      `;
    }

    if (item.type === "file") {
      html += renderFile(item);
    }
  }

  return html;
}

function renderFile(item, showPath = false) {
  const extension = getExtension(item.name);
  const detail = showPath
    ? `${extension.toUpperCase()} · ${getParentPath(item.path)}`
    : extension.toUpperCase();

  return `
    <tr class="document-row file-row" data-row-action="open-file" data-url="${escapeAttribute(item.url)}">
      <td>
        <div class="entry-main">
          <span class="icon-tile file-tile" aria-hidden="true">
            <i class="bi ${getIcon(extension)}"></i>
          </span>
          <span>
            <span class="entry-name">${escapeHtml(item.name)}</span>
            <span class="entry-detail">${escapeHtml(detail)}</span>
          </span>
        </div>
      </td>
      <td>${formatBytes(item.size)}</td>
      <td class="row-actions">
        <a class="icon-action" href="${item.url}" target="_blank" rel="noopener" aria-label="Abrir ${escapeAttribute(item.name)}">
          <i class="bi bi-box-arrow-up-right"></i>
        </a>
        <a class="icon-action primary-action" href="${item.url}" download aria-label="Descargar ${escapeAttribute(item.name)}">
          <i class="bi bi-download"></i>
        </a>
      </td>
    </tr>
  `;
}

function getAllFiles(items) {
  return items.flatMap((item) => {
    if (item.type === "file") return [item];
    return getAllFiles(item.children);
  });
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

function getParentPath(path) {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

function getCurrentPathLabel() {
  return [rootFolder, ...currentPath].join("/");
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
    pdf: "bi-file-earmark-pdf",
    doc: "bi-file-earmark-word",
    docx: "bi-file-earmark-word",
    xls: "bi-file-earmark-spreadsheet",
    xlsx: "bi-file-earmark-spreadsheet",
    csv: "bi-filetype-csv",
    zip: "bi-file-earmark-zip",
    rar: "bi-file-earmark-zip",
    "7z": "bi-file-earmark-zip",
    png: "bi-file-earmark-image",
    jpg: "bi-file-earmark-image",
    jpeg: "bi-file-earmark-image",
    webp: "bi-file-earmark-image",
    gif: "bi-file-earmark-image",
    txt: "bi-file-earmark-text",
    md: "bi-file-earmark-text",
    ppt: "bi-file-earmark-slides",
    pptx: "bi-file-earmark-slides"
  };

  return icons[extension] || "bi-file-earmark";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttribute(text) {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

function showStatus(message) {
  pathBar.innerHTML = "";
  fileList.innerHTML = `<div class="status">${escapeHtml(message)}</div>`;
}

searchInput.addEventListener("input", () => {
  renderCurrentFolder();
});

fileList.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  const link = event.target.closest("a");

  if (link) return;

  if (!target) {
    const row = event.target.closest("[data-row-action]");
    if (!row) return;

    handleRowAction(row);
    return;
  }

  handleNavigationAction(target);
});

pathBar.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  handleNavigationAction(target);
});

fileList.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  if (event.target.closest("a, button, input")) return;

  const row = event.target.closest("[data-row-action]");
  if (!row) return;

  event.preventDefault();
  handleRowAction(row);
});

function handleRowAction(row) {
  const action = row.dataset.rowAction;

  if (action === "open-folder") {
    currentPath.push(row.dataset.name);
    searchInput.value = "";
    renderCurrentFolder();
  }

  if (action === "open-file") {
    window.open(row.dataset.url, "_blank", "noopener");
  }
}

function handleNavigationAction(target) {
  const action = target.dataset.action;

  if (action === "open-folder") {
    currentPath.push(target.dataset.name);
    searchInput.value = "";
    renderCurrentFolder();
  }

  if (action === "back") {
    currentPath.pop();
    searchInput.value = "";
    renderCurrentFolder();
  }

  if (action === "breadcrumb") {
    currentPath = target.dataset.path ? target.dataset.path.split("/") : [];
    searchInput.value = "";
    renderCurrentFolder();
  }
}

loadFiles();
