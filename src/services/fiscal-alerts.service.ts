export type FiscalAlertEntity = "PRODUCT" | "TAXATION" | "FAMILY" | "SUPPLIER";
export type FiscalAlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type FiscalAlertItem = { id: string; code: string; description: string; currentValue: string; suggestedValue: string; source: string; confidence: number };
export type FiscalAlertGroup = { id: string; title: string; description: string; entity: FiscalAlertEntity; field: string; severity: FiscalAlertSeverity; affected: number; items: FiscalAlertItem[] };

const groups: FiscalAlertGroup[] = [
  { id: "product-missing-ncm", title: "Produtos sem NCM", description: "Produtos importados sem classificação fiscal.", entity: "PRODUCT", field: "NCM", severity: "CRITICAL", affected: 38, items: [
    { id: "p-101", code: "000101", description: "Café torrado e moído 500g", currentValue: "Não informado", suggestedValue: "0901.21.00", source: "Catálogo Central + SPED", confidence: 96 },
    { id: "p-184", code: "000184", description: "Leite integral UHT 1L", currentValue: "Não informado", suggestedValue: "0401.20.10", source: "Catálogo Central", confidence: 94 },
    { id: "p-233", code: "000233", description: "Biscoito recheado chocolate", currentValue: "Não informado", suggestedValue: "1905.31.00", source: "SPED + regra fiscal", confidence: 91 },
  ] },
  { id: "tax-wrong-cest", title: "Divergência de CEST", description: "CEST cadastrado diverge da classificação sugerida.", entity: "TAXATION", field: "CEST", severity: "HIGH", affected: 24, items: [
    { id: "t-421", code: "000421", description: "Refrigerante cola 2L", currentValue: "03.007.00", suggestedValue: "03.010.00", source: "Regra tributária vigente", confidence: 98 },
    { id: "t-425", code: "000425", description: "Água mineral 500ml", currentValue: "03.001.00", suggestedValue: "03.005.00", source: "Regra tributária vigente", confidence: 97 },
  ] },
  { id: "tax-rate", title: "Alíquota de ICMS divergente", description: "Alíquota observada difere da regra aplicável ao produto e UF.", entity: "TAXATION", field: "Alíquota ICMS", severity: "HIGH", affected: 17, items: [
    { id: "t-610", code: "000610", description: "Detergente líquido 500ml", currentValue: "18%", suggestedValue: "12%", source: "Pauta e regra por UF", confidence: 93 },
    { id: "t-615", code: "000615", description: "Sabão em pó 1kg", currentValue: "12%", suggestedValue: "18%", source: "Regra por UF", confidence: 95 },
  ] },
  { id: "family-unlinked", title: "Produtos sem família", description: "Produtos sem vínculo com família ou categoria válida.", entity: "FAMILY", field: "Família", severity: "MEDIUM", affected: 31, items: [
    { id: "f-710", code: "000710", description: "Molho de tomate 300g", currentValue: "Sem família", suggestedValue: "Mercearia > Molhos", source: "Similaridade cadastral", confidence: 89 },
    { id: "f-711", code: "000711", description: "Maionese 500g", currentValue: "Diversos", suggestedValue: "Mercearia > Condimentos", source: "Catálogo Central", confidence: 92 },
  ] },
  { id: "supplier-document", title: "Fornecedores incompletos", description: "Fornecedores vinculados a produtos com dados obrigatórios pendentes.", entity: "SUPPLIER", field: "Cadastro", severity: "MEDIUM", affected: 12, items: [
    { id: "s-801", code: "FOR-0081", description: "Distribuidora Alimentos Brasil", currentValue: "IE não informada", suggestedValue: "Validar IE na SEFAZ", source: "Cadastro fornecedor", confidence: 100 },
    { id: "s-804", code: "FOR-0084", description: "Comercial Bebidas Sul", currentValue: "CNPJ sem validação", suggestedValue: "Validar situação cadastral", source: "Receita Federal", confidence: 100 },
  ] },
];

export const fiscalAlertsService = { summary: async () => { await new Promise((resolve) => setTimeout(resolve, 300)); return groups; } };
