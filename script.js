// Load CSV URLs from a text file dynamically
const CSV_TXT_URL = 'https://raw.githubusercontent.com/kuenastar115/scbd/main/src/csvs.txt';

function slugify(title) {
  return title.trim()
              .toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/[^\w\-]/g, '');
}

function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// ✨ Utilities for search highlighting
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlight(text, words) {
  let escapedWords = words.map(w => escapeRegExp(w));
  const pattern = new RegExp(`(${escapedWords.join('|')})`, 'gi');
  return text.replace(pattern, '<mark>$1</mark>');
}

// Load All CSVs from txt file
async function loadAllCSVs() {
  try {
    const txtRes = await fetch(CSV_TXT_URL);
    const txtContent = await txtRes.text();
    const csvUrls = txtContent.split('\n').map(line => line.trim()).filter(Boolean);

    const texts = await Promise.all(csvUrls.map(url => fetch(url).then(res => res.text())));
    const allData = texts.flatMap(text => Papa.parse(text, { header: true, skipEmptyLines: true }).data);
    return allData;
  } catch (err) {
    console.error("Failed to load CSVs from TXT:", err);
    return [];
  }
}

// 🧩 Load external HTML partials (header & footer)
document.addEventListener("DOMContentLoaded", () => {
  async function loadPartial(selector, file, callback) {
    const el = document.querySelector(selector);
    if (el) {
      try {
        const res = await fetch(file);
        const html = await res.text();
        el.innerHTML = html;
        if (typeof callback === 'function') callback();
      } catch (err) {
        console.error(`Failed to load partial ${file}:`, err);
      }
    }
  }

  loadPartial("#header-placeholder", "/components/header.html", () => {
    const form = document.getElementById('searchForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const input = document.getElementById('searchInput').value.trim();
        if (input) {
          const query = input.toLowerCase().replace(/\s+/g, '-');
          const baseUrl = window.location.origin;
          window.location.href = `${baseUrl}/search?query=${query}`;
        }
      });
    }
  });

  loadPartial("#footer-placeholder", "/components/footer.html");
});



// 📄 PDF page rendering
if (document.getElementById('title-section')) {
  let documentId = null;
  let titleSlug = null;

  const pathParts = window.location.pathname.split('/');
  const slugPart = pathParts.includes('pdf') ? pathParts.pop() : null;

  if (slugPart) {
    const match = slugPart.match(/^([0-9]+)-(.+)$/);
  if (match) {
    documentId = match[1];     // "123"
    titleSlug = match[2];      // "title"
      }
  }

  const titleEl = document.getElementById('title-section');
  const descEl = document.getElementById('description-section');
  const iframeEl = document.getElementById('iframe-section');
  const suggEl = document.getElementById('suggestion-section');

  if (!documentId || !titleSlug) {
    titleEl.innerHTML = `<p class="description">Error: Missing document ID or title in URL.</p>`;
  } else {
    loadAllCSVs()
      .then(data => {
        const doc = data.find(d => d.ID.trim() === documentId.trim() && slugify(d.Title) === titleSlug);
       
        //breadcrumb
        const breadcrumb = document.getElementById('breadcrumb');
        const currentDoc = data.find(d => d.ID === documentId);

        if (breadcrumb && currentDoc) {
        breadcrumb.innerHTML = `<a href=\"/\">Home</a> &raquo; ${currentDoc.Title}`;
        }

        if (!doc) {
          titleEl.innerHTML = `<p class="description">Document not found for ID: ${documentId} and title: ${titleSlug}</p>`;
          return;
        }

        document.title = `[PDF] ${doc.Title} | English Resources`;
        const encodedTitle = encodeURIComponent(doc.Title).replace(/%20/g, '+');
        const downloadUrl = `https://scribd.vdownloaders.com/document/${doc.ID}/${titleSlug}`;
        

        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
          metaDescription.setAttribute('content', doc.Summary.slice(0, 160));
        }

        titleEl.innerHTML = `<h1>${doc.Title}</h1>`;

        descEl.innerHTML = `
          <p class="description">${doc.Summary}.</p>
          <p class="description">
            <strong>${doc.Title}</strong> contains ${doc.Pages} pages in a PDF document type uploaded by SCRB Downloader Team. This PDF document with an ID ${doc.ID}
            has been downloaded for ${doc.Views} times. In this document entitled ${doc.Title}, we can get a lot of benefits and information.
          </p>
          <a class="download-button" href="${downloadUrl}" target="_blank"><span style="font-size: 20px;">DOWNLOAD PDF</span></a>
        `;

        iframeEl.innerHTML = `
          <iframe class="scribd_iframe_embed"
            title="${doc.Title}"
            src="https://www.scribd.com/embeds/${doc.ID}/content?start_page=1&view_mode=scroll&access_key=key-NCzuA9v6DY7zHHNCjjID"
            tabindex="0"
            data-auto-height="true"
            data-aspect-ratio="0.6536"
            scrolling="no"
            width="100%"
            height="800"
            frameborder="0">
          </iframe>
        `;

        // 🔄 UPDATED: Suggestion with random domain from URLs.txt
        fetch('https://raw.githubusercontent.com/kuenastar115/scbd/main/src/urls.txt')
          .then(res => res.text())
          .then(text => {
            const domains = text.split('\n').map(line => line.trim()).filter(Boolean);

            const otherDocs = data.filter(d => d.ID.trim() !== doc.ID.trim());
            const shuffled = otherDocs.sort(() => 0.5 - Math.random()).slice(0, 10);

            const suggestions = shuffled.map(d => {
              const slug = slugify(d.Title);
              const randomDomain = domains[Math.floor(Math.random() * domains.length)];
              const url = `${randomDomain}/pdf/${d.ID}-${slug}`;
              return `
                <div class="related-post">
                  <div class="related-post-title">
                    <a href="${url}">${d.Title}</a>
                  </div>
                  <div class="related-post-text">${d.Summary}
                    <hr class="post-divider">
                  </div>
                </div>
              `;
            }).join('');

            suggEl.innerHTML = `
              <h2>Documents related to ${doc.Title}</h2>
              <hr class="post-divider">
              ${suggestions}
            `;
          })
          .catch(err => {
            console.error('Error fetching URLs.txt:', err);
            suggEl.innerHTML = `<p>Error loading related documents.</p>`;
          });
      })
      .catch(err => {
        console.error('Failed to load CSV:', err);
        titleEl.innerHTML = `<p>Error loading document data.</p>`;
      });
  }
}


// 🏠 Index page: show random 10 docs
if (document.getElementById('results') && !document.getElementById('header')) {
  loadAllCSVs()
    .then(data => {
      const shuffled = data.sort(() => 0.5 - Math.random()).slice(0, 10);

      const suggestions = shuffled.map(d => {
        const slug = slugify(d.Title);
        const baseUrl = window.location.origin;
        const url = `${baseUrl}/pdf/${d.ID}-${slug}`;
        return `
          <div class="related-post">
            <div class="related-post-title">
              <a href="${url}">${d.Title}</a>
            </div>
            <div class="related-post-text">
              ${d.Summary}
              <hr class="post-divider">
            </div>
          </div>
        `;
      }).join('');

      document.getElementById('results').innerHTML = suggestions;
    })
    .catch(err => {
      console.error('Error loading index:', err);
      document.getElementById('results').innerHTML = '<p>Error loading documents.</p>';
    });
}
// 🔍 Search page rendering
if (document.getElementById('header') && document.getElementById('results')) {
  const baseUrl = window.location.origin;
  const queryParam = getQueryParam('query');
  const pageParam = parseInt(getQueryParam('page')) || 1;
  const RESULTS_PER_PAGE = 10;
  const queryWords = queryParam ? queryParam.toLowerCase().split('-').filter(Boolean) : [];
  const headerEl = document.getElementById('header');
  const container = document.getElementById('results');

  if (!queryParam || queryWords.length === 0) {
    headerEl.textContent = "Please enter a search query.";
    container.innerHTML = "";
  } else {
    document.title = `SCRIBD documents related to ${queryParam.replace(/-/g, ' ')}`;
    loadAllCSVs()
      .then(data => {
          const matches = data
          .map(d => {
          const title = d.Title.toLowerCase();
          const summary = d.Summary.toLowerCase();
          const fullQuery = queryWords.join(' ');

          let relevance = 0;
          if (slugify(d.Title) === queryParam) {
            relevance = 100; // exact slug match
          } else if (title.includes(fullQuery)) {
            relevance = 75; // strong partial title match
          } else if (queryWords.some(q => title.includes(q))) {
            relevance = 50;
          } else if (queryWords.some(q => summary.includes(q))) {
            relevance = 25;
          }
      
          return { ...d, relevance };
        })
        .filter(d => d.relevance > 0)
        .sort((a, b) => b.relevance - a.relevance);

        const totalPages = Math.ceil(matches.length / RESULTS_PER_PAGE);
        const startIndex = (pageParam - 1) * RESULTS_PER_PAGE;
        const pageResults = matches.slice(startIndex, startIndex + RESULTS_PER_PAGE);

        if (matches.length > 0) {
          headerEl.textContent = `${matches.length} document${matches.length !== 1 ? 's' : ''} found for '${queryParam.replace(/-/g, ' ')}'.`;
          const output = pageResults.map(d => {
            const slug = slugify(d.Title);
            const url = `${baseUrl}/pdf/${d.ID}-${slug}`;
            const highlightedTitle = highlight(d.Title, queryWords);
            const highlightedSummary = highlight(d.Summary, queryWords);
            return `
              <hr class="post-divider">
              <div class="related-post">
                <div class="related-post-title">
                  <a href="${url}">${highlightedTitle}</a>
                </div>
                <div class="related-post-text">${highlightedSummary}</div>
              </div>
            `;
          }).join('');

          container.innerHTML = output;
                  
          const paginationHTML = generatePagination(queryParam, pageParam, totalPages);
          container.innerHTML += paginationHTML;

           function generatePagination(queryParam, currentPage, totalPages) {
            const maxVisible = 5;
            let paginationHTML = '<div class="pagination">';
          
            if (currentPage > 1) {
              paginationHTML += `<a href="?query=${queryParam}&page=${currentPage - 1}">Prev</a>`;
            }
          
            const pages = [];
          
            if (totalPages <= 8) {
              // Show all pages if few
              for (let i = 1; i <= totalPages; i++) pages.push(i);
            } else {
              if (currentPage <= 4) {
                // Show 1 to 6, then ellipsis, then last
                for (let i = 1; i <= 6; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
              } else if (currentPage >= totalPages - 3) {
                // Show first, ellipsis, then last 6 pages
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 5; i <= totalPages; i++) pages.push(i);
              } else {
                // Show first, ellipsis, 2 before & after current, ellipsis, last
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 2; i <= currentPage + 2; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
              }
            }
          
            pages.forEach(p => {
              if (p === '...') {
                paginationHTML += `<span class="dots">...</span>`;
              } else {
                paginationHTML += `<a href="?query=${queryParam}&page=${p}" ${p === currentPage ? 'class="active"' : ''}>${p}</a>`;
              }
            });
          
            if (currentPage < totalPages) {
              paginationHTML += `<a href="?query=${queryParam}&page=${currentPage + 1}">Next</a>`;
            }
          
            paginationHTML += '</div>';
            return paginationHTML;
          }

          
        } else {
          headerEl.textContent = `No documents found for '${queryParam.replace(/-/g, ' ')}'. But, these documents might be interesting for you.`;
          const suggestions = data.sort(() => 0.5 - Math.random()).slice(0, 10).map(d => {
            const slug = slugify(d.Title);
            const url = `${baseUrl}/pdf/${d.ID}-${slug}`;
            return `
              <hr class="post-divider">
              <div class="related-post">
                <div class="related-post-title">
                  <a href="${url}">${d.Title}</a>
                </div>
                <div class="related-post-text">${d.Summary}</div>
              </div>
            `;
          }).join('');

          container.innerHTML = suggestions;
        }
      })
      .catch(err => {
        console.error('Error loading search results:', err);
        container.innerHTML = '<p>Error loading search results.</p>';
      });
  }
}


//header margin
  window.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('header');
    const main = document.querySelector('main');
    main.style.marginTop = header.offsetHeight + 'px';
  });
