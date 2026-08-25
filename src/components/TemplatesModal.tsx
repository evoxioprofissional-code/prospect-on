"use client";

import { useState } from "react";
import type { MessageTemplate } from "@/lib/useTemplates";

export default function TemplatesModal({
  templates,
  onCreate,
  onUpdate,
  onRemove,
  onClose,
}: {
  templates: MessageTemplate[];
  onCreate: (name: string, body: string) => Promise<MessageTemplate | null>;
  onUpdate: (
    id: string,
    patch: Partial<Pick<MessageTemplate, "name" | "body">>
  ) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-paper border border-line rounded-xl w-full max-w-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-line">
          <div>
            <span className="eyebrow">Modelos de mensagem</span>
            <h3 className="font-display font-bold text-lg leading-tight">
              Gerenciar modelos
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink text-lg leading-none"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          {templates.map((t) => (
            <TemplateRow
              key={t.id}
              t={t}
              onUpdate={onUpdate}
              onRemove={onRemove}
              canDelete={templates.length > 1}
            />
          ))}

          <button
            disabled={creating}
            onClick={async () => {
              setCreating(true);
              await onCreate(
                "Novo modelo",
                "Escreva sua mensagem aqui. Use {empresa} {nome} {cidade} {nicho} {gancho} — preenchem sozinhos por lead."
              );
              setCreating(false);
            }}
            className="w-full h-11 rounded-lg border border-dashed border-line text-sm text-muted hover:border-ink hover:text-ink disabled:opacity-60"
          >
            {creating ? "Adicionando…" : "+ Adicionar modelo"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplateRow({
  t,
  onUpdate,
  onRemove,
  canDelete,
}: {
  t: MessageTemplate;
  onUpdate: (
    id: string,
    patch: Partial<Pick<MessageTemplate, "name" | "body">>
  ) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  canDelete: boolean;
}) {
  const [name, setName] = useState(t.name);
  const [body, setBody] = useState(t.body);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = name.trim() !== t.name || body !== t.body;

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    await onUpdate(t.id, { name: name.trim(), body });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="border border-line rounded-lg p-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome do modelo"
        className="w-full h-10 px-3 border border-line rounded-lg bg-paper outline-none focus:border-ink font-medium mb-2"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        className="w-full px-3 py-2 border border-line rounded-lg bg-paper outline-none focus:border-ink resize-none text-sm leading-relaxed"
      />
      <div className="flex items-center gap-2 mt-2">
        <button
          disabled={!dirty || saving}
          onClick={save}
          className="h-9 px-4 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 disabled:opacity-50"
        >
          {saving ? "Salvando…" : "Salvar"}
        </button>
        {saved && <span className="text-xs text-green-700">Salvo</span>}
        {canDelete && (
          <button
            onClick={() => {
              if (confirm(`Excluir o modelo "${t.name}"?`)) onRemove(t.id);
            }}
            className="ml-auto h-9 px-3 rounded-lg border border-line text-sm text-muted hover:text-brand hover:border-brand"
          >
            Excluir
          </button>
        )}
      </div>
    </div>
  );
}
