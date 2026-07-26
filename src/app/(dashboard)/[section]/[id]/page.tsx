"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, CirclePlay, Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { alerts, executions } from "@/services/mocks/data";
import { getApiErrorMessage } from "@/services/api/client";
import { connectionsService, type Connection } from "@/services/connections.service";
import { dataSourcesService, type DataSourceFieldSummary, type DataSourceSummary } from "@/services/data-sources.service";
import { rulesService, type RelationshipSuggestion } from "@/services/rules.service";
import { Button, Card, Notice, PageHeader, SeverityBadge, StatusBadge, dateTime, money } from "@/components/shared/ui";

type RuleFormState = {
  name: string;
  description: string;
  ruleType: "EXISTENCE" | "AMOUNT_COMPARISON";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  amountTolerance: string;
  integrationToleranceMinutes: string;
  originDataSourceId: string;
  destinationDataSourceId: string;
};

type JoinRow = {
  originFieldId: string;
  destinationFieldId: string;
  normalizationType: "NONE" | "TRIM" | "UPPERCASE" | "REMOVE_LEADING_ZEROS" | "DATE_ONLY";
};

type SourceBrowserState = {
  connectionId: string;
  tablePrefix: string;
  selectedTable: string;
  tables: string[];
  loading: boolean;
  loaded: boolean;
};

const normalizationOptions: JoinRow["normalizationType"][] = ["NONE", "TRIM", "UPPERCASE", "REMOVE_LEADING_ZEROS", "DATE_ONLY"];
const ruleSteps = ["Informacoes", "Fontes", "Relacionamentos", "Filtros", "Valores", "Teste", "Revisao"];
const initialSourceBrowser: SourceBrowserState = { connectionId: "", tablePrefix: "", selectedTable: "", tables: [], loading: false, loaded: false };
const initialRuleForm: RuleFormState = {
  name: "",
  description: "",
  ruleType: "EXISTENCE",
  severity: "HIGH",
  amountTolerance: "0.01",
  integrationToleranceMinutes: "0",
  originDataSourceId: "",
  destinationDataSourceId: "",
};

export default function Detail() {
  const { section, id } = useParams<{ section: string; id: string }>();
  if (id === "new" && section === "rules") return <RuleWizard />;
  if (id === "new") return <Wizard section={section} />;
  if (section === "alerts") return <AlertDetail id={id} />;
  if (section === "executions") return <ExecutionDetail id={id} />;
  return <FormDetail section={section} id={id} />;
}

function RuleWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<RuleFormState>(initialRuleForm);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [dataSources, setDataSources] = useState<DataSourceSummary[]>([]);
  const [originBrowser, setOriginBrowser] = useState<SourceBrowserState>(initialSourceBrowser);
  const [destinationBrowser, setDestinationBrowser] = useState<SourceBrowserState>(initialSourceBrowser);
  const [joins, setJoins] = useState<JoinRow[]>([{ originFieldId: "", destinationFieldId: "", normalizationType: "NONE" }]);
  const [suggestions, setSuggestions] = useState<RelationshipSuggestion[]>([]);
  const [promptSuggestions, setPromptSuggestions] = useState<RelationshipSuggestion[]>([]);
  const [promptText, setPromptText] = useState("");
  const [generatedQuery, setGeneratedQuery] = useState("");
  const [relationshipMessage, setRelationshipMessage] = useState("");
  const [loadingSources, setLoadingSources] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingSources(true);
      try {
        const [connectionsResponse, sourcesResponse] = await Promise.all([connectionsService.list(), dataSourcesService.list()]);
        if (!active) return;
        setConnections(connectionsResponse.items.filter(item => item.active));
        setDataSources(sourcesResponse.items.filter(item => item.active));
      } catch (err) {
        if (!active) return;
        setError(getApiErrorMessage(err));
      } finally {
        if (active) setLoadingSources(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const originSource = dataSources.find(item => item.id === form.originDataSourceId);
  const destinationSource = dataSources.find(item => item.id === form.destinationDataSourceId);
  const originConnection = connections.find(item => item.id === originBrowser.connectionId);
  const destinationConnection = connections.find(item => item.id === destinationBrowser.connectionId);
  const filteredOriginSources = dataSources.filter(item => item.connectionId === originBrowser.connectionId && (!originBrowser.selectedTable || item.tableName === originBrowser.selectedTable));
  const filteredDestinationSources = dataSources.filter(item => item.connectionId === destinationBrowser.connectionId && (!destinationBrowser.selectedTable || item.tableName === destinationBrowser.selectedTable));
  const originFields = activeFields(originSource);
  const destinationFields = activeFields(destinationSource);

  useEffect(() => {
    setForm(current => {
      if (filteredOriginSources.some(item => item.id === current.originDataSourceId)) return current;
      const nextOriginDataSourceId = filteredOriginSources.length === 1 ? filteredOriginSources[0].id : "";
      if (current.originDataSourceId === nextOriginDataSourceId) return current;
      return { ...current, originDataSourceId: nextOriginDataSourceId };
    });
  }, [filteredOriginSources]);

  useEffect(() => {
    setForm(current => {
      if (filteredDestinationSources.some(item => item.id === current.destinationDataSourceId)) return current;
      const nextDestinationDataSourceId = filteredDestinationSources.length === 1 ? filteredDestinationSources[0].id : "";
      if (current.destinationDataSourceId === nextDestinationDataSourceId) return current;
      return { ...current, destinationDataSourceId: nextDestinationDataSourceId };
    });
  }, [filteredDestinationSources]);

  useEffect(() => {
    setJoins([{ originFieldId: "", destinationFieldId: "", normalizationType: "NONE" }]);
    setSuggestions([]);
    setPromptSuggestions([]);
    setGeneratedQuery("");
    setRelationshipMessage("");
  }, [form.originDataSourceId, form.destinationDataSourceId]);

  const updateForm = <K extends keyof RuleFormState>(key: K) => (value: RuleFormState[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const updateOriginBrowser = (patch: Partial<SourceBrowserState>) => {
    setOriginBrowser(current => ({ ...current, ...patch }));
  };

  const updateDestinationBrowser = (patch: Partial<SourceBrowserState>) => {
    setDestinationBrowser(current => ({ ...current, ...patch }));
  };

  const loadTables = async (side: "origin" | "destination") => {
    const browser = side === "origin" ? originBrowser : destinationBrowser;
    const setBrowser = side === "origin" ? setOriginBrowser : setDestinationBrowser;
    if (!browser.connectionId) {
      setError("Selecione o Connector antes de carregar as consultas autorizadas.");
      return;
    }
    if (!browser.tablePrefix.trim()) {
      setError("Informe um filtro de consulta antes de carregar a lista.");
      return;
    }
    setError("");
    setBrowser(current => ({ ...current, loading: true, loaded: false, tables: [], selectedTable: "" }));
    try {
      const rows = await connectionsService.tables(browser.connectionId, browser.tablePrefix.trim().toUpperCase());
      setBrowser(current => ({ ...current, loading: false, loaded: true, tables: rows.map(item => item.TABLE_NAME) }));
    } catch (err) {
      setBrowser(current => ({ ...current, loading: false, loaded: false, tables: [] }));
      setError(getApiErrorMessage(err));
    }
  };

  const updateJoin = (index: number, patch: Partial<JoinRow>) => {
    setJoins(current => current.map((join, currentIndex) => (currentIndex === index ? { ...join, ...patch } : join)));
  };

  const addJoin = (preset?: Partial<JoinRow>) => {
    setJoins(current => [...current, { originFieldId: preset?.originFieldId ?? "", destinationFieldId: preset?.destinationFieldId ?? "", normalizationType: preset?.normalizationType ?? "NONE" }]);
  };

  const removeJoin = (index: number) => {
    setJoins(current => (current.length === 1 ? current : current.filter((_, currentIndex) => currentIndex !== index)));
  };

  const applySuggestion = (suggestion: RelationshipSuggestion) => {
    setJoins(current => {
      const exists = current.some(join => join.originFieldId === suggestion.originFieldId && join.destinationFieldId === suggestion.destinationFieldId);
      if (exists) return current;
      return [...current.filter(join => join.originFieldId || join.destinationFieldId), {
        originFieldId: suggestion.originFieldId,
        destinationFieldId: suggestion.destinationFieldId,
        normalizationType: suggestion.normalizationType,
      }];
    });
  };

  const suggestRelationships = async () => {
    if (!originSource || !destinationSource) {
      setError("Selecione a fonte de origem e a fonte de destino antes de solicitar sugestoes.");
      return;
    }
    setLoadingSuggestions(true);
    setError("");
    try {
      const response = await rulesService.suggestRelationships(originSource.id, destinationSource.id);
      setSuggestions(response.suggestions);
      setRelationshipMessage(response.suggestions.length ? "Sugestoes carregadas com base nos nomes e tipos semanticos dos campos." : "Nenhum relacionamento automatico foi encontrado para essas fontes.");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const analysePrompt = () => {
    if (!originSource || !destinationSource) {
      setError("Selecione as fontes antes de analisar a descricao.");
      return;
    }
    const promptDriven = buildPromptSuggestions(promptText, originSource, destinationSource);
    setPromptSuggestions(promptDriven);
    setRelationshipMessage(promptDriven.length ? "Analise guiada pela descricao concluida. Revise os relacionamentos antes de validar." : "Nao encontrei pistas suficientes na descricao para sugerir relacionamentos.");
    if (promptDriven.length) {
      setJoins(promptDriven.slice(0, 3).map(item => ({
        originFieldId: item.originFieldId,
        destinationFieldId: item.destinationFieldId,
        normalizationType: item.normalizationType,
      })));
    }
  };

  const validateManualRelationship = async () => {
    if (!originSource || !destinationSource) {
      setError("Selecione as fontes antes de validar os relacionamentos.");
      return;
    }
    const selectedJoins = joins.filter(join => join.originFieldId && join.destinationFieldId);
    if (!selectedJoins.length) {
      setError("Informe ao menos um relacionamento entre os campos.");
      return;
    }
    setValidating(true);
    setError("");
    try {
      const response = await rulesService.validateManualRelationship({
        originDataSourceId: originSource.id,
        destinationDataSourceId: destinationSource.id,
        joins: selectedJoins.map(join => ({ originFieldId: join.originFieldId, destinationFieldId: join.destinationFieldId })),
      });
      setGeneratedQuery(response.generatedQuery);
      setRelationshipMessage(response.message);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setValidating(false);
    }
  };

  const saveRule = async () => {
    const selectedJoins = joins.filter(join => join.originFieldId && join.destinationFieldId);
    if (!form.name || !originSource || !destinationSource) {
      setError("Preencha nome da regra, origem e destino antes de salvar.");
      return;
    }
    if (!selectedJoins.length) {
      setError("Adicione ao menos um relacionamento valido antes de salvar.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await rulesService.save({
        name: form.name,
        description: form.description || null,
        ruleType: form.ruleType,
        severity: form.severity,
        amountTolerance: Number(form.amountTolerance || 0),
        integrationToleranceMinutes: Number(form.integrationToleranceMinutes || 0),
        originDataSourceId: form.originDataSourceId,
        destinationDataSourceId: form.destinationDataSourceId,
        joins: selectedJoins.map((join, index) => ({
          originFieldId: join.originFieldId,
          destinationFieldId: join.destinationFieldId,
          normalizationType: join.normalizationType,
          sequence: index + 1,
        })),
        filters: [],
      });
      router.push("/rules");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    if (step < ruleSteps.length) {
      setStep(current => current + 1);
      return;
    }
    await saveRule();
  };

  return (
    <>
      <PageHeader title="Nova regra" description="Configure fontes, relacionamentos e validacao antes de ativar a conciliacao." />
      <Card className="p-6">
        <div className="mb-8 flex overflow-auto">
          {ruleSteps.map((label, index) => (
            <div key={label} className="flex min-w-28 items-center">
              <span className={`grid size-7 place-items-center rounded-full text-xs font-bold ${index + 1 <= step ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-500"}`}>{index + 1}</span>
              <span className="ml-2 text-xs font-medium text-slate-600">{label}</span>
              {index < ruleSteps.length - 1 && <i className="mx-3 h-px flex-1 bg-slate-200" />}
            </div>
          ))}
        </div>

        {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {step === 1 && <RuleInformationStep form={form} updateForm={updateForm} />}
        {step === 2 && (
          <RuleSourcesStep
            form={form}
            connections={connections}
            loadingSources={loadingSources}
            originBrowser={originBrowser}
            destinationBrowser={destinationBrowser}
            originConnection={originConnection}
            destinationConnection={destinationConnection}
            filteredOriginSources={filteredOriginSources}
            filteredDestinationSources={filteredDestinationSources}
            onOriginBrowserChange={updateOriginBrowser}
            onDestinationBrowserChange={updateDestinationBrowser}
            onOriginDataSourceChange={updateForm("originDataSourceId")}
            onDestinationDataSourceChange={updateForm("destinationDataSourceId")}
            onLoadOriginTables={() => void loadTables("origin")}
            onLoadDestinationTables={() => void loadTables("destination")}
          />
        )}
        {step === 3 && (
          <RuleRelationshipsStep
            joins={joins}
            originFields={originFields}
            destinationFields={destinationFields}
            suggestions={suggestions}
            promptSuggestions={promptSuggestions}
            promptText={promptText}
            generatedQuery={generatedQuery}
            relationshipMessage={relationshipMessage}
            loadingSuggestions={loadingSuggestions}
            validating={validating}
            onPromptChange={setPromptText}
            onAnalysePrompt={analysePrompt}
            onSuggestRelationships={suggestRelationships}
            onValidate={validateManualRelationship}
            onAddJoin={() => addJoin()}
            onRemoveJoin={removeJoin}
            onApplySuggestion={applySuggestion}
            onUpdateJoin={updateJoin}
          />
        )}
        {step === 4 && <RuleFiltersStep />}
        {step === 5 && <RuleValuesStep form={form} updateForm={updateForm} />}
        {step === 6 && <RuleTestStep generatedQuery={generatedQuery} validating={validating} onValidate={validateManualRelationship} />}
        {step === 7 && <RuleReviewStep form={form} originSource={originSource} destinationSource={destinationSource} joins={joins} generatedQuery={generatedQuery} />}

        <div className="mt-8 flex justify-between border-t border-slate-100 pt-5">
          <Button variant="secondary" onClick={() => (step > 1 ? setStep(current => current - 1) : router.back())}>Voltar</Button>
          <Button disabled={saving || loadingSources} onClick={() => void next()}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {step === ruleSteps.length ? "Salvar regra" : "Continuar"}
          </Button>
        </div>
      </Card>
    </>
  );
}

function RuleInformationStep({ form, updateForm }: { form: RuleFormState; updateForm: <K extends keyof RuleFormState>(key: K) => (value: RuleFormState[K]) => void; }) {
  return (
    <>
      <h2 className="text-lg font-bold">Informacoes gerais</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Nome da regra" value={form.name} onChange={updateForm("name")} placeholder="Ex.: Titulo sem contabilizacao" />
        <Field label="Descricao" value={form.description} onChange={updateForm("description")} placeholder="Contexto da validacao" />
        <SelectField label="Tipo" value={form.ruleType} onChange={value => updateForm("ruleType")(value as RuleFormState["ruleType"])} options={[{ value: "EXISTENCE", label: "Verificacao de existencia" }, { value: "AMOUNT_COMPARISON", label: "Comparacao de valores" }]} />
        <SelectField label="Severidade" value={form.severity} onChange={value => updateForm("severity")(value as RuleFormState["severity"])} options={[{ value: "CRITICAL", label: "Critica" }, { value: "HIGH", label: "Alta" }, { value: "MEDIUM", label: "Media" }, { value: "LOW", label: "Baixa" }]} />
        <Field label="Tolerancia de valor" value={form.amountTolerance} onChange={updateForm("amountTolerance")} type="number" />
        <Field label="Tolerancia de integracao (minutos)" value={form.integrationToleranceMinutes} onChange={updateForm("integrationToleranceMinutes")} type="number" />
      </div>
    </>
  );
}

function RuleSourcesStep({
  form,
  connections,
  loadingSources,
  originBrowser,
  destinationBrowser,
  originConnection,
  destinationConnection,
  filteredOriginSources,
  filteredDestinationSources,
  onOriginBrowserChange,
  onDestinationBrowserChange,
  onOriginDataSourceChange,
  onDestinationDataSourceChange,
  onLoadOriginTables,
  onLoadDestinationTables,
}: {
  form: RuleFormState;
  connections: Connection[];
  loadingSources: boolean;
  originBrowser: SourceBrowserState;
  destinationBrowser: SourceBrowserState;
  originConnection?: Connection;
  destinationConnection?: Connection;
  filteredOriginSources: DataSourceSummary[];
  filteredDestinationSources: DataSourceSummary[];
  onOriginBrowserChange: (patch: Partial<SourceBrowserState>) => void;
  onDestinationBrowserChange: (patch: Partial<SourceBrowserState>) => void;
  onOriginDataSourceChange: (value: string) => void;
  onDestinationDataSourceChange: (value: string) => void;
  onLoadOriginTables: () => void;
  onLoadDestinationTables: () => void;
}) {
  return (
    <>
      <h2 className="text-lg font-bold">Fontes da conciliacao</h2>
      <p className="mt-1 text-sm text-slate-500">Escolha o Connector e carregue apenas códigos de consulta previamente autorizados. Nenhum SQL é enviado pelo frontend.</p>
      {loadingSources ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Carregando bases e fontes de dados...</div>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <RuleSourceBrowserCard
            title="Origem"
            browser={originBrowser}
            connection={originConnection}
            connections={connections}
            selectedDataSourceId={form.originDataSourceId}
            availableSources={filteredOriginSources}
            onBrowserChange={onOriginBrowserChange}
            onDataSourceChange={onOriginDataSourceChange}
            onLoadTables={onLoadOriginTables}
          />
          <RuleSourceBrowserCard
            title="Destino"
            browser={destinationBrowser}
            connection={destinationConnection}
            connections={connections}
            selectedDataSourceId={form.destinationDataSourceId}
            availableSources={filteredDestinationSources}
            onBrowserChange={onDestinationBrowserChange}
            onDataSourceChange={onDestinationDataSourceChange}
            onLoadTables={onLoadDestinationTables}
          />
        </div>
      )}
    </>
  );
}

function RuleSourceBrowserCard({
  title,
  browser,
  connection,
  connections,
  selectedDataSourceId,
  availableSources,
  onBrowserChange,
  onDataSourceChange,
  onLoadTables,
}: {
  title: string;
  browser: SourceBrowserState;
  connection?: Connection;
  connections: Connection[];
  selectedDataSourceId: string;
  availableSources: DataSourceSummary[];
  onBrowserChange: (patch: Partial<SourceBrowserState>) => void;
  onDataSourceChange: (value: string) => void;
  onLoadTables: () => void;
}) {
  return (
    <Card className="p-4">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 space-y-4">
        <SelectField
          label="Connector"
          value={browser.connectionId}
          onChange={value => {
            onBrowserChange({ connectionId: value, tablePrefix: "", selectedTable: "", tables: [], loaded: false });
            onDataSourceChange("");
          }}
          options={connections.map(item => ({ value: item.id, label: item.name }))}
          placeholder="Selecione o Connector"
        />

        {connection && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <p><span className="font-semibold text-slate-900">URL:</span> {connection.connectorBaseUrl}</p>
            <p className="mt-1"><span className="font-semibold text-slate-900">Status:</span> {connection.connectorStatus}</p>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
          <Field label="Filtro de consulta" value={browser.tablePrefix} onChange={value => onBrowserChange({ tablePrefix: value.toLowerCase(), selectedTable: "", tables: [], loaded: false })} placeholder="Ex.: financial" />
          <div className="pt-6">
            <Button className="w-full" variant="secondary" disabled={!browser.connectionId || !browser.tablePrefix.trim() || browser.loading} onClick={onLoadTables}>
              {browser.loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Carregar consultas
            </Button>
          </div>
        </div>

        {!browser.loaded && <Notice>Antes de listar consultas, informe um filtro como `financial`.</Notice>}

        {browser.loaded && (
          <>
            <SelectField
              label="Consulta autorizada"
              value={browser.selectedTable}
              onChange={value => {
                onBrowserChange({ selectedTable: value });
                onDataSourceChange("");
              }}
              options={browser.tables.map(item => ({ value: item, label: item }))}
              placeholder={browser.tables.length ? "Selecione a consulta" : "Nenhuma consulta encontrada"}
            />

            <SelectField
              label="Fonte cadastrada"
              value={selectedDataSourceId}
              onChange={onDataSourceChange}
              options={availableSources.map(source => ({ value: source.id, label: `${source.name} (${source.schemaName}.${source.tableName})` }))}
              placeholder={availableSources.length ? "Selecione a fonte cadastrada" : "Nenhuma fonte cadastrada para esta consulta"}
            />

            {!availableSources.length && browser.selectedTable && (
              <Notice>O código `{browser.selectedTable}` está autorizado no Connector, mas ainda não há uma fonte cadastrada. Cadastre a fonte antes de concluir a regra.</Notice>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function RuleRelationshipsStep(props: {
  joins: JoinRow[];
  originFields: DataSourceFieldSummary[];
  destinationFields: DataSourceFieldSummary[];
  suggestions: RelationshipSuggestion[];
  promptSuggestions: RelationshipSuggestion[];
  promptText: string;
  generatedQuery: string;
  relationshipMessage: string;
  loadingSuggestions: boolean;
  validating: boolean;
  onPromptChange: (value: string) => void;
  onAnalysePrompt: () => void;
  onSuggestRelationships: () => void;
  onValidate: () => void;
  onAddJoin: () => void;
  onRemoveJoin: (index: number) => void;
  onApplySuggestion: (suggestion: RelationshipSuggestion) => void;
  onUpdateJoin: (index: number, patch: Partial<JoinRow>) => void;
}) {
  const {
    joins,
    originFields,
    destinationFields,
    suggestions,
    promptSuggestions,
    promptText,
    generatedQuery,
    relationshipMessage,
    loadingSuggestions,
    validating,
    onPromptChange,
    onAnalysePrompt,
    onSuggestRelationships,
    onValidate,
    onAddJoin,
    onRemoveJoin,
    onApplySuggestion,
    onUpdateJoin,
  } = props;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Relacionamentos entre campos</h2>
          <p className="mt-1 text-sm text-slate-500">Monte manualmente os joins, use sugestoes automaticas ou descreva o contexto para receber uma proposta inicial.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onSuggestRelationships} disabled={loadingSuggestions}>
            {loadingSuggestions ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Sugerir pela estrutura
          </Button>
          <Button variant="secondary" onClick={onValidate} disabled={validating}>
            {validating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Validar consulta
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <Card className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">Relacionamento manual</h3>
                <p className="text-sm text-slate-500">Cada linha gera uma clausula de join validada pelo backend.</p>
              </div>
              <Button variant="secondary" onClick={onAddJoin}><Plus size={16} /> Adicionar linha</Button>
            </div>

            <div className="mt-4 space-y-3">
              {joins.map((join, index) => (
                <div key={`${index}-${join.originFieldId}-${join.destinationFieldId}`} className="grid gap-3 rounded-xl border border-slate-200 p-3 lg:grid-cols-[1fr_1fr_220px_44px]">
                  <SelectField label={`Origem ${index + 1}`} value={join.originFieldId} onChange={value => onUpdateJoin(index, { originFieldId: value })} options={originFields.map(field => ({ value: field.id, label: `${field.fieldName} (${semanticLabel(field.semanticType)})` }))} placeholder="Campo da origem" compact />
                  <SelectField label={`Destino ${index + 1}`} value={join.destinationFieldId} onChange={value => onUpdateJoin(index, { destinationFieldId: value })} options={destinationFields.map(field => ({ value: field.id, label: `${field.fieldName} (${semanticLabel(field.semanticType)})` }))} placeholder="Campo do destino" compact />
                  <SelectField label="Normalizacao" value={join.normalizationType} onChange={value => onUpdateJoin(index, { normalizationType: value as JoinRow["normalizationType"] })} options={normalizationOptions.map(option => ({ value: option, label: normalizationLabel(option) }))} />
                  <button type="button" onClick={() => onRemoveJoin(index)} className="mt-6 inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold text-slate-900">Analise guiada por descricao</h3>
            <p className="mt-1 text-sm text-slate-500">Descreva a relacao entre as tabelas, como `fi_titulo`, `abam_financeiroconf` e `abam_financeiroconfplano`, e a tela tenta priorizar os joins mais provaveis.</p>
            <textarea value={promptText} onChange={event => onPromptChange(event.target.value)} rows={5} className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2" placeholder="Ex.: a especie de fi_titulo esta configurada em abam_financeiroconf e ligada ao plano em abam_financeiroconfplano por id, codigo e sequencia" />
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" onClick={onAnalysePrompt}><Sparkles size={16} /> Analisar descricao</Button>
            </div>
            {promptSuggestions.length > 0 && (
              <div className="mt-4 space-y-2">
                {promptSuggestions.map(suggestion => (
                  <SuggestionCard key={`prompt-${suggestion.originFieldId}-${suggestion.destinationFieldId}`} suggestion={suggestion} actionLabel="Usar" onApply={() => onApplySuggestion(suggestion)} />
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-4">
            <h3 className="font-semibold text-slate-900">Sugestoes da estrutura</h3>
            <p className="mt-1 text-sm text-slate-500">Baseadas em nome de campo e tipo semantico.</p>
            <div className="mt-4 space-y-2">
              {suggestions.length ? suggestions.map(suggestion => (
                <SuggestionCard key={`${suggestion.originFieldId}-${suggestion.destinationFieldId}`} suggestion={suggestion} actionLabel="Aplicar" onApply={() => onApplySuggestion(suggestion)} />
              )) : <Notice>Nenhuma sugestao carregada ainda. Use o botao `Sugerir pela estrutura`.</Notice>}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold text-slate-900">Previa da query</h3>
            <p className="mt-1 text-sm text-slate-500">A consulta abaixo e montada pelo backend a partir dos relacionamentos escolhidos.</p>
            {relationshipMessage && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{relationshipMessage}</div>}
            <pre className="mt-4 min-h-52 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">{generatedQuery || "Valide os relacionamentos para gerar a consulta de conferencia."}</pre>
          </Card>
        </div>
      </div>
    </>
  );
}

function RuleFiltersStep() {
  return (
    <>
      <h2 className="text-lg font-bold">Filtros</h2>
      <Notice>Os filtros avancados continuam opcionais nesta fase do MVP. A regra sera salva apenas com os relacionamentos entre origem e destino.</Notice>
    </>
  );
}

function RuleValuesStep({ form, updateForm }: { form: RuleFormState; updateForm: <K extends keyof RuleFormState>(key: K) => (value: RuleFormState[K]) => void; }) {
  return (
    <>
      <h2 className="text-lg font-bold">Parametros de comparacao</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Tolerancia de valor" value={form.amountTolerance} onChange={updateForm("amountTolerance")} type="number" />
        <Field label="Janela de integracao (minutos)" value={form.integrationToleranceMinutes} onChange={updateForm("integrationToleranceMinutes")} type="number" />
      </div>
      <Notice>Para regras do tipo `AMOUNT_COMPARISON`, a API usara esses limites ao comparar os registros relacionados.</Notice>
    </>
  );
}

function RuleTestStep({ generatedQuery, validating, onValidate }: { generatedQuery: string; validating: boolean; onValidate: () => void; }) {
  return (
    <>
      <h2 className="text-lg font-bold">Teste da regra</h2>
      <Notice>Antes de salvar, voce pode validar se os joins formam uma consulta coerente. O backend gera a query, mas nao executa nenhum SQL digitado pelo usuario.</Notice>
      <div className="mt-5 flex gap-3">
        <Button onClick={onValidate} disabled={validating}>
          {validating ? <Loader2 size={16} className="animate-spin" /> : <CirclePlay size={16} />}
          Validar novamente
        </Button>
      </div>
      {generatedQuery && <pre className="mt-5 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">{generatedQuery}</pre>}
    </>
  );
}

function RuleReviewStep({ form, originSource, destinationSource, joins, generatedQuery }: { form: RuleFormState; originSource?: DataSourceSummary; destinationSource?: DataSourceSummary; joins: JoinRow[]; generatedQuery: string; }) {
  const selectedJoins = joins.filter(join => join.originFieldId && join.destinationFieldId);
  return (
    <>
      <h2 className="text-lg font-bold">Revisao final</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <SummaryItem label="Regra" value={form.name || "Nao informado"} />
        <SummaryItem label="Tipo" value={form.ruleType} />
        <SummaryItem label="Origem" value={originSource ? `${originSource.schemaName}.${originSource.tableName}` : "Nao selecionada"} />
        <SummaryItem label="Destino" value={destinationSource ? `${destinationSource.schemaName}.${destinationSource.tableName}` : "Nao selecionado"} />
        <SummaryItem label="Severidade" value={form.severity} />
        <SummaryItem label="Relacionamentos" value={String(selectedJoins.length)} />
      </div>
      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        {generatedQuery ? "A consulta preliminar foi gerada com sucesso e sera reproduzida pelo backend ao validar a regra." : "Ainda nao existe uma query validada. Voce pode voltar ao passo de relacionamentos para gerar a previa."}
      </div>
    </>
  );
}

function Wizard({ section }: { section: string }) {
  const names: Record<string, string> = { connections: "Nova conexao ERP", "data-sources": "Nova fonte de dados", rules: "Nova regra" };
  const [step, setStep] = useState(1);
  const router = useRouter();
  const total = section === "data-sources" ? 4 : 1;
  const labels = section === "data-sources" ? ["Informacoes", "Tabela", "Mapeamento", "Revisao"] : ["Configuracao"];

  return (
    <>
      <PageHeader title={names[section] ?? "Novo registro"} description="Preencha as informacoes abaixo para concluir o cadastro." />
      <Card className="p-6">
        <div className="mb-8 flex overflow-auto">
          {labels.map((label, index) => (
            <div key={label} className="flex min-w-28 items-center">
              <span className={`grid size-7 place-items-center rounded-full text-xs font-bold ${index + 1 <= step ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-500"}`}>{index + 1}</span>
              <span className="ml-2 text-xs font-medium text-slate-600">{label}</span>
              {index < labels.length - 1 && <i className="mx-3 h-px flex-1 bg-slate-200" />}
            </div>
          ))}
        </div>
        <StepContent section={section} step={step} />
        <div className="mt-8 flex justify-between border-t border-slate-100 pt-5">
          <Button variant="secondary" onClick={() => (step > 1 ? setStep(step - 1) : router.back())}>Voltar</Button>
          <Button onClick={() => (step < total ? setStep(step + 1) : router.push(`/${section}`))}>{step === total ? "Salvar" : "Continuar"}</Button>
        </div>
      </Card>
    </>
  );
}

function StepContent({ section, step }: { section: string; step: number }) {
  const fields = section === "connections"
    ? ["Nome da conexao", "Host", "Porta", "Service name", "Schema", "Usuario", "Senha", "Timeout de conexao"]
    : section === "data-sources" && step === 1
      ? ["Nome", "Descricao", "Tipo", "Conexao"]
      : [];

  if (section === "data-sources" && step === 3) {
    return (
      <>
        <h2 className="text-lg font-bold">Mapeamento semantico</h2>
        <p className="mt-1 text-sm text-slate-500">Associe os campos do ERP aos significados utilizados na conciliacao.</p>
        <div className="mt-5 overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3">Coluna</th>
                <th>Tipo Oracle</th>
                <th>Significado</th>
                <th>Obrigatoria</th>
              </tr>
            </thead>
            <tbody>
              {["INVOICE_ID", "ORG_ID", "INVOICE_NUM", "VENDOR_NAME", "INVOICE_AMOUNT"].map((value, index) => (
                <tr key={value} className="border-t">
                  <td className="p-3 font-mono">{value}</td>
                  <td>VARCHAR2</td>
                  <td><select className="rounded border p-1"><option>{["Chave primaria", "Empresa", "Documento", "Pessoa", "Valor"][index]}</option></select></td>
                  <td><input type="checkbox" defaultChecked={index < 4} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <>
      <h2 className="text-lg font-bold">{step === 1 ? "Informacoes gerais" : "Revise as informacoes"}</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {fields.map(field => (
          <label key={field} className="text-sm font-semibold text-slate-700">
            {field}
            <input className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 font-normal" placeholder={`Informe ${field.toLowerCase()}`} type={field === "Senha" ? "password" : "text"} />
          </label>
        ))}
      </div>
    </>
  );
}

function AlertDetail({ id }: { id: string }) {
  const alert = alerts.find(item => item.id === id) ?? alerts[0];
  const [status, setStatus] = useState(alert.status);
  return (
    <>
      <PageHeader title={`Alerta ${alert.id}`} description="Detalhamento e tratamento da divergencia." action={<Link href="/alerts"><Button variant="secondary"><ArrowLeft size={16} /> Voltar</Button></Link>} />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card className="p-6">
            <div className="flex flex-wrap items-center gap-3"><SeverityBadge value={alert.severity} /><StatusBadge value={status} /><span className="text-sm text-slate-500">Criado em {dateTime(alert.createdAt)}</span></div>
            <h2 className="mt-5 text-xl font-bold">{alert.document} · {alert.person}</h2>
            <p className="mt-3 leading-7 text-slate-600">O titulo financeiro esta ativo e possui valor de {money(alert.originValue)}. Nao foi localizado lancamento contabil correspondente para o identificador de origem configurado.</p>
          </Card>
          <Card>
            <div className="border-b p-4 font-semibold">Comparacao</div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left"><tr><th className="p-3">Campo</th><th>Origem</th><th>Destino</th><th>Resultado</th></tr></thead>
              <tbody>
                <tr className="border-t"><td className="p-3">Documento</td><td>{alert.document}</td><td>-</td><td className="text-red-600">Divergente</td></tr>
                <tr className="border-t"><td className="p-3">Valor</td><td>{money(alert.originValue)}</td><td>{money(alert.accountingValue)}</td><td className="text-red-600">Divergente</td></tr>
              </tbody>
            </table>
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold">Dados tecnicos da origem</h2>
            <pre className="mt-3 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-200">{JSON.stringify({ company: alert.company, branch: alert.branch, document: alert.document, person: alert.person, value: alert.originValue, status: "ACTIVE" }, null, 2)}</pre>
          </Card>
        </div>
        <Card className="h-fit p-5">
          <h2 className="font-semibold">Tratamento</h2>
          <label className="mt-4 block text-sm">Responsavel<select className="mt-1 w-full rounded-lg border p-2"><option>Nao atribuido</option><option>Mariana Costa</option></select></label>
          <label className="mt-3 block text-sm">Novo status<select value={status} onChange={event => setStatus(event.target.value as typeof status)} className="mt-1 w-full rounded-lg border p-2"><option value="OPEN">Aberto</option><option value="IN_ANALYSIS">Em analise</option><option value="RESOLVED">Resolvido</option><option value="IGNORED">Ignorado</option></select></label>
          <label className="mt-3 block text-sm">Causa raiz<textarea className="mt-1 w-full rounded-lg border p-2" rows={3} /></label>
          <label className="mt-3 block text-sm">Acao realizada<textarea className="mt-1 w-full rounded-lg border p-2" rows={3} /></label>
          <Button className="mt-4 w-full"><Save size={15} /> Salvar tratamento</Button>
        </Card>
      </div>
    </>
  );
}

function ExecutionDetail({ id }: { id: string }) {
  const execution = executions.find(item => item.id === id) ?? executions[0];
  return (
    <>
      <PageHeader title={`Execucao ${execution.id}`} description="Acompanhamento do processamento da regra." />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex justify-between"><div><p className="text-sm text-slate-500">Regra executada</p><h2 className="text-xl font-bold">{execution.rule}</h2></div><StatusBadge value={execution.status} /></div>
          <div className="mt-6 grid grid-cols-3 gap-3">{[["Analisados", execution.analyzed], ["Conciliados", execution.matched], ["Divergentes", execution.divergent]].map(item => <div key={String(item[0])} className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">{item[0]}</p><b className="text-xl">{Number(item[1]).toLocaleString("pt-BR")}</b></div>)}</div>
        </Card>
        <Card className="p-5"><p className="text-sm text-slate-500">Valor divergente</p><b className="mt-2 block text-2xl text-red-700">{money(execution.amount)}</b><p className="mt-4 text-sm text-slate-500">Inicio: {dateTime(execution.startedAt)}</p>{execution.status === "RUNNING" && <Notice>Atualizacao automatica ativa.</Notice>}</Card>
      </div>
    </>
  );
}

function FormDetail({ section, id }: { section: string; id: string }) {
  const title = section === "connections" ? "Conexao ERP" : section === "rules" ? "Regra de conciliacao" : "Fonte de dados";
  return (
    <>
      <PageHeader title={`${id.includes("edit") ? "Editar" : "Detalhes da"} ${title}`} action={<Button><Save size={16} /> Salvar alteracoes</Button>} />
      <Card className="max-w-3xl p-6"><StepContent section={section} step={1} /></Card>
    </>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; }) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} type={type} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none ring-blue-500 focus:ring-2" />
    </label>
  );
}

function SelectField({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; placeholder?: string; compact?: boolean; }) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <select value={value} onChange={event => onChange(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal outline-none ring-blue-500 focus:ring-2">
        <option value="">{placeholder ?? "Selecione"}</option>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function SuggestionCard({ suggestion, actionLabel, onApply }: { suggestion: RelationshipSuggestion; actionLabel: string; onApply: () => void; }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">{suggestion.originField} = {suggestion.destinationField}</p>
          <p className="mt-1 text-xs text-slate-500">{suggestion.reason}</p>
        </div>
        <Button variant="secondary" onClick={onApply}>{actionLabel}</Button>
      </div>
      <div className="mt-2 flex gap-2 text-xs text-slate-500">
        <span className="rounded-full bg-slate-100 px-2 py-0.5">{suggestion.confidence}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5">{normalizationLabel(suggestion.normalizationType)}</span>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-900">{value}</p></div>;
}

function activeFields(source?: DataSourceSummary) {
  return source?.fields.filter(field => field.active) ?? [];
}

function normalizationLabel(value: JoinRow["normalizationType"]) {
  return {
    NONE: "Nenhuma",
    TRIM: "Remover espacos",
    UPPERCASE: "Maiusculas",
    REMOVE_LEADING_ZEROS: "Remover zeros a esquerda",
    DATE_ONLY: "Somente data",
  }[value];
}

function semanticLabel(value: string) {
  return value.replace(/_/g, " ").toLowerCase();
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function buildPromptSuggestions(promptText: string, originSource: DataSourceSummary, destinationSource: DataSourceSummary): RelationshipSuggestion[] {
  const prompt = normalizeText(promptText);
  const keywords = ["ID", "COD", "CODIGO", "SEQ", "SEQUENCIA", "EMPRESA", "FILIAL", "DOCUMENTO", "PESSOA", "VALOR", "ESPECIE", "PLANO"];
  const highlighted = keywords.filter(keyword => prompt.includes(keyword));
  const candidates: Array<RelationshipSuggestion & { score: number }> = [];

  for (const originField of activeFields(originSource)) {
    for (const destinationField of activeFields(destinationSource)) {
      const originName = normalizeText(`${originField.fieldName} ${originField.label} ${originField.semanticType}`);
      const destinationName = normalizeText(`${destinationField.fieldName} ${destinationField.label} ${destinationField.semanticType}`);
      let score = 0;
      if (originField.semanticType === destinationField.semanticType && originField.semanticType !== "OTHER") score += 4;
      if (originName === destinationName) score += 6;
      if (originName.includes("ID") && destinationName.includes("ID")) score += 3;
      if (originName.includes("SEQ") && destinationName.includes("SEQ")) score += 3;
      if (originName.includes("COD") && destinationName.includes("COD")) score += 2;
      if (highlighted.some(keyword => originName.includes(keyword) && destinationName.includes(keyword))) score += 5;
      if (score < 5) continue;
      candidates.push({
        originFieldId: originField.id,
        destinationFieldId: destinationField.id,
        originField: originField.fieldName,
        destinationField: destinationField.fieldName,
        normalizationType: "NONE",
        confidence: score >= 11 ? "HIGH" : "MEDIUM",
        reason: highlighted.length ? `Descricao menciona ${highlighted.slice(0, 3).join(", ")} e os campos apresentam compatibilidade.` : "Campos com sinais fortes de relacao por nome ou tipo semantico.",
        score,
      });
    }
  }

  return candidates
    .sort((left, right) => right.score - left.score)
    .filter((candidate, index, list) => index === list.findIndex(item => item.originFieldId === candidate.originFieldId && item.destinationFieldId === candidate.destinationFieldId))
    .slice(0, 5)
    .map(({ score: _score, ...suggestion }) => suggestion);
}
