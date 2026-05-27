const GITHUB_USER = "aruznieto";
const GITHUB_REPO = "anieto";
const FOLDER = "publicaciones";

const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${FOLDER}`;

const fileList = document.getElementById("fileList");
const searchInput = document.getElementById("searchInput");

let files = [];

async function loadFiles() {
  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error("No se pudieron cargar los archivos");
    }

    const data = await response.json();

    files = data
      .filter(item => item.type === "file")
      .sort((a, b) => a.name.localeCompare(b.name));

    renderFiles(files);
  } catch (error) {
    fileList.innerHTML = `
      <div class="empty">
        No se pudieron cargar los archivos. Comprueba que el repositorio sea público 
        y que exista la carpeta <strong>${FOLDER}</strong>.
      </div>
    `;
  }
}

function renderFiles(fileArray) {
  if (fileArray.length === 0) {
    fileList.innerHTML = `
      <div class="empty">
        No hay archivos disponibles.
      </div>
    `;
    return;
  }

  fileList.innerHTML = fileArray.map(file => {
    const size = formatBytes(file.size);
    const extension = getExtension(file.name);

    return `
      <article class="file-card">
        <div class="file-info">
          <div class="file-name">${getIcon(extension)} ${file.name}</div>
          <div class="file-meta">${extension.toUpperCase()} · ${size}</div>
        </div>
        <div class="file-actions">
          <a href="${file.download_url}" target="_blank" rel="noopener">
            Descargar
          </a>
        </div>
      </article>
    `;
  }).join("");
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
}

function getExtension(filename) {
  return filename.split(".").pop().toLowerCase();
}

function getIcon(extension) {
  const icons = {
    pdf: "📄",
    doc: "📝",
    docx: "📝",
    xls: "📊",
    xlsx: "📊",
    zip: "🗜️",
    rar: "🗜️",
    png: "🖼️",
    jpg: "🖼️",
    jpeg: "🖼️",
    webp: "🖼️",
    txt: "📃"
  };

  return icons[extension] || "📁";
}

searchInput.addEventListener("input", () => {
  const query = searchInput.value.toLowerCase();

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(query)
  );

  renderFiles(filteredFiles);
});

loadFiles();
