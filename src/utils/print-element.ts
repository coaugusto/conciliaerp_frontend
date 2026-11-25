// Imprime só um trecho da tela (ex.: o contrato), sem menu, abas, cabeçalho nem o botão de ajuda.
// window.print() imprime a página inteira; aqui o trecho é copiado para um iframe invisível com as
// mesmas folhas de estilo (Tailwind, incluindo as classes print:*), e só ele vai para a impressora.
// O título vira o nome sugerido do PDF no "Salvar como PDF".
export function printElement(element: HTMLElement | null, title: string) {
  if (!element) return;
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  // Fora da tela, mas com tamanho real: alguns navegadores montam a impressão com a largura do iframe.
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:1024px;height:1200px;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) { frame.remove(); window.print(); return; }

  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((node) => node.outerHTML).join("\n");
  const content = element.cloneNode(true) as HTMLElement;
  // Campos de edição não levam o valor digitado no clone: fixa o texto antes de imprimir.
  content.querySelectorAll("textarea").forEach((field, index) => { field.textContent = element.querySelectorAll("textarea")[index]?.value ?? field.textContent; });
  doc.open();
  doc.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")}</title>${styles}
    <style>@page{margin:14mm} html,body{background:#fff} body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact} .print-root>*{box-shadow:none!important;border:0!important;margin:0!important;max-width:none!important}</style>
    </head><body><div class="print-root">${content.outerHTML}</div></body></html>`);
  doc.close();

  const cleanup = () => setTimeout(() => frame.remove(), 500);
  const run = () => {
    win.focus();
    win.addEventListener("afterprint", cleanup, { once: true });
    win.print();
    // Navegadores que não disparam afterprint no iframe: remove depois de um tempo.
    setTimeout(cleanup, 60_000);
  };
  // Espera as folhas de estilo do iframe carregarem; sem isso o contrato sai sem formatação.
  const links = [...doc.querySelectorAll('link[rel="stylesheet"]')] as HTMLLinkElement[];
  Promise.all(links.map((link) => link.sheet ? Promise.resolve() : new Promise((resolve) => { link.addEventListener("load", resolve, { once: true }); link.addEventListener("error", resolve, { once: true }); })))
    .then(() => (doc.fonts?.ready ?? Promise.resolve()))
    .then(run);
}
