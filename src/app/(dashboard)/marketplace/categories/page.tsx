"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ChevronRight, Folder, FolderOpen, Package } from "lucide-react";
import { Button, Card, ErrorState, PageHeader } from "@/components/shared/ui";
import { getApiErrorMessage } from "@/services/api/client";
import { masterCatalogCategoryService, type CategoryNode } from "@/services/master-catalog-category.service";

type TreeNode = CategoryNode & { children: TreeNode[] };

function buildTree(nodes: CategoryNode[]): TreeNode[] {
  const byId = new Map<string, TreeNode>(nodes.map((node) => [node.id, { ...node, children: [] }]));
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId)!.children.push(node);
    else roots.push(node);
  }
  const sortByName = (list: TreeNode[]) => { list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")); list.forEach((item) => sortByName(item.children)); };
  sortByName(roots);
  return roots;
}

export default function CategoryTreePage() {
  const queryClient = useQueryClient();
  const tree = useQuery({ queryKey: ["master-catalog-category-tree"], queryFn: masterCatalogCategoryService.tree });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [dragProductId, setDragProductId] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);

  const roots = useMemo(() => buildTree(tree.data ?? []), [tree.data]);
  const nodesById = useMemo(() => new Map((tree.data ?? []).map((node) => [node.id, node])), [tree.data]);
  const isLeaf = (id: string) => !(tree.data ?? []).some((node) => node.parentId === id);

  const products = useQuery({ queryKey: ["master-catalog-category-products", selectedId, page], queryFn: () => masterCatalogCategoryService.productsByNode(selectedId!, page), enabled: Boolean(selectedId) });
  const relink = useMutation({
    mutationFn: ({ productId, categoryNodeId }: { productId: string; categoryNodeId: string }) => masterCatalogCategoryService.linkCategory(productId, categoryNodeId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["master-catalog-category-tree"] }); queryClient.invalidateQueries({ queryKey: ["master-catalog-category-products"] }); },
    onError: (error) => setDropError(getApiErrorMessage(error)),
  });

  const toggle = (id: string) => setExpanded((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const selectLeaf = (id: string) => { setSelectedId(id); setPage(1); };

  const handleDrop = (targetId: string) => {
    setDropError(null);
    if (!dragProductId) return;
    if (!isLeaf(targetId)) { setDropError("Só é possível classificar um produto em uma categoria-folha (sem subcategorias)."); setDragProductId(null); return; }
    relink.mutate({ productId: dragProductId, categoryNodeId: targetId });
    setDragProductId(null);
  };

  return <>
    <PageHeader title="Categorias" description="Hierarquia mercadológica do catálogo central — arraste um produto para outra categoria-folha para reclassificar." action={<Link href="/marketplace" className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"><ArrowLeft size={16} />Voltar</Link>} />
    {tree.isError && <ErrorState message="Não foi possível carregar a árvore de categorias." />}
    {!tree.isError && (
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 p-4"><h2 className="font-bold text-slate-900">Árvore de categorias</h2></div>
          {tree.isLoading ? <div className="space-y-2 p-4">{[1, 2, 3].map((item) => <div key={item} className="h-6 animate-pulse rounded bg-slate-100" />)}</div>
            : !roots.length ? <p className="p-4 text-sm text-slate-500">Nenhuma categoria ainda — a árvore é montada automaticamente conforme os clientes sincronizam dados de classificação mercadológica pelo Connector.</p>
            : <ul className="max-h-[70vh] overflow-y-auto p-2 text-sm">{roots.map((node) => <TreeItem key={node.id} node={node} depth={0} expanded={expanded} onToggle={toggle} selectedId={selectedId} onSelect={selectLeaf} onDrop={handleDrop} dragActive={Boolean(dragProductId)} />)}</ul>}
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 p-4"><h2 className="font-bold text-slate-900">Produtos</h2><p className="mt-0.5 text-xs text-slate-500">{selectedId ? nodesById.get(selectedId)?.name : "Selecione uma categoria-folha na árvore para ver os produtos vinculados."}</p></div>
          {dropError && <div className="border-b border-slate-200 p-4"><ErrorState message={dropError} /></div>}
          {!selectedId ? <p className="p-8 text-center text-sm text-slate-500">Nenhuma categoria selecionada.</p>
            : products.isLoading ? <div className="space-y-2 p-4">{[1, 2, 3].map((item) => <div key={item} className="h-10 animate-pulse rounded bg-slate-100" />)}</div>
            : products.isError ? <ErrorState message="Não foi possível carregar os produtos desta categoria." />
            : !products.data?.items.length ? <p className="p-8 text-center text-sm text-slate-500">Nenhum produto vinculado a esta categoria.</p>
            : <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Produto</th><th className="p-3">NCM</th><th className="p-3">GTIN</th></tr></thead>
                    <tbody>
                      {products.data.items.map((product) => (
                        <tr key={product.id} draggable onDragStart={() => setDragProductId(product.id)} onDragEnd={() => setDragProductId(null)} className={`cursor-grab border-t border-slate-100 active:cursor-grabbing ${dragProductId === product.id ? "opacity-40" : ""}`}>
                          <td className="p-3 font-medium text-slate-800"><Package size={14} className="mr-1.5 inline text-slate-400" /><Link href={`/marketplace/products/${encodeURIComponent(product.id)}`} className="hover:underline">{product.canonicalDescription}</Link></td>
                          <td className="p-3 font-mono text-xs">{product.ncm ?? "—"}</td>
                          <td className="p-3 font-mono text-xs">{product.gtin ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {products.data.totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-200 p-3 text-xs text-slate-500">
                    <span>Página {products.data.page} de {products.data.totalPages} · {products.data.total} produto(s)</span>
                    <div className="flex gap-2"><Button variant="secondary" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Anterior</Button><Button variant="secondary" onClick={() => setPage((current) => Math.min(products.data!.totalPages, current + 1))} disabled={page >= products.data.totalPages}>Próxima</Button></div>
                  </div>
                )}
              </>}
        </Card>
      </div>
    )}
  </>;
}

function TreeItem({ node, depth, expanded, onToggle, selectedId, onSelect, onDrop, dragActive }: { node: TreeNode; depth: number; expanded: Set<string>; onToggle: (id: string) => void; selectedId: string | null; onSelect: (id: string) => void; onDrop: (id: string) => void; dragActive: boolean }) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);
  const [dragOver, setDragOver] = useState(false);
  const acceptsDrop = !hasChildren;
  return (
    <li>
      <div
        style={{ paddingLeft: depth * 16 }}
        onDragOver={acceptsDrop ? (event) => { event.preventDefault(); setDragOver(true); } : undefined}
        onDragLeave={acceptsDrop ? () => setDragOver(false) : undefined}
        onDrop={acceptsDrop ? (event) => { event.preventDefault(); setDragOver(false); onDrop(node.id); } : undefined}
        className={`flex items-center gap-1 rounded-md px-1.5 py-1.5 ${selectedId === node.id ? "bg-cyan-50 text-cyan-800" : "text-slate-700 hover:bg-slate-50"} ${dragOver ? "ring-2 ring-cyan-400" : ""} ${acceptsDrop && dragActive ? "outline-dashed outline-1 outline-slate-300" : ""}`}
      >
        {hasChildren
          ? <button type="button" onClick={() => onToggle(node.id)} className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-200">{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
          : <span className="w-[22px] shrink-0" />}
        {hasChildren ? (isOpen ? <FolderOpen size={15} className="shrink-0 text-amber-500" /> : <Folder size={15} className="shrink-0 text-amber-500" />) : <Package size={13} className="shrink-0 text-slate-400" />}
        {acceptsDrop
          ? <button type="button" onClick={() => onSelect(node.id)} className="flex-1 truncate text-left font-medium">{node.name}</button>
          : <button type="button" onClick={() => onToggle(node.id)} className="flex-1 truncate text-left">{node.name}</button>}
        {node.productCount > 0 && <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{node.productCount}</span>}
      </div>
      {hasChildren && isOpen && <ul>{node.children.map((child) => <TreeItem key={child.id} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} selectedId={selectedId} onSelect={onSelect} onDrop={onDrop} dragActive={dragActive} />)}</ul>}
    </li>
  );
}
