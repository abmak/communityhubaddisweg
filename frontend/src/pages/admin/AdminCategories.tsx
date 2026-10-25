import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Clapperboard,
  Coffee,
  Dumbbell,
  Heart,
  LayoutGrid,
  Loader2,
  Mountain,
  Music,
  Palette,
  Plane,
  Plus,
  Trophy,
  Trash2,
  Edit3,
  MessagesSquare,
} from "lucide-react";
import { api, apiError } from "../../lib/api";
import { useQuery } from "../../hooks/useApi";
import { useUI } from "../../store/ui";
import type { Category } from "../../types";
import type { CategoriesResponse } from "../../lib/adminTypes";
import { Badge, ConfirmDialog, EmptyState, Modal, PageLoader } from "../../components/ui";
import { useAdminAccess } from "./AdminLayout";
import { AdminPageHeader } from "./parts";

const ICONS = [
  "Coffee",
  "Trophy",
  "Sparkles",
  "Clapperboard",
  "BookOpen",
  "Mountain",
  "Music",
  "Dumbbell",
  "Palette",
  "Plane",
  "Heart",
  "MessageCircle",
] as const;

const ICON_MAP: Record<string, typeof Coffee> = {
  Coffee,
  Trophy,
  Sparkles: LayoutGrid,
  Clapperboard,
  BookOpen,
  Mountain,
  Music,
  Dumbbell,
  Palette,
  Plane,
  Heart,
  MessageCircle: MessagesSquare,
};

function iconFor(name: string) {
  return ICON_MAP[name] ?? MessagesSquare;
}

const EMPTY_FORM = {
  name: "",
  slug: "",
  description: "",
  icon: "MessageCircle",
  color: "#0f6b3a",
  kind: "DISCUSSION",
  sortOrder: "10",
};

export function AdminCategories() {
  const { permissions } = useAdminAccess();
  const canManage = permissions.includes("admin.categories.manage");
  const pushToast = useUI((state) => state.pushToast);
  const query = useQuery<CategoriesResponse>("/api/admin/categories");

  const [open, setOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const handleOpenEdit = (category: Category) => {
    setEditingCategory(category);
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description,
      icon: category.icon || "MessageCircle",
      color: category.color || "#0f6b3a",
      kind: category.kind || "DISCUSSION",
      sortOrder: String(category.sortOrder ?? 10),
    });
    setOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim(),
        icon: form.icon,
        color: form.color,
        kind: form.kind,
        sortOrder: Number(form.sortOrder) || 0,
      };

      if (editingCategory) {
        await api.patch(`/api/admin/categories/${editingCategory.id}`, payload);
        pushToast("Room updated successfully.", { tone: "success" });
      } else {
        await api.post("/api/admin/categories", payload);
        pushToast("Room created.", { tone: "success" });
      }
      setOpen(false);
      setEditingCategory(null);
      setForm(EMPTY_FORM);
      query.refetch();
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.delete(`/api/admin/categories/${deleteTarget.id}`);
      pushToast("Room removed.", { tone: "success" });
      setDeleteTarget(null);
      query.refetch();
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const categories = query.data?.categories ?? [];

  return (
    <div>
      <AdminPageHeader
        eyebrow="Platform"
        title="Community rooms."
        description="Rooms are the front doors of Addis Gebeta: each one owns its feed, its navigation entry and its place-kind artwork. New rooms appear immediately."
        actions={
          canManage ? (
            <button type="button" className="btn-primary btn-sm" onClick={handleOpenCreate}>
              <Plus className="h-3.5 w-3.5" /> New room
            </button>
          ) : (
            <Badge tone="neutral">Read-only for your role</Badge>
          )
        }
      />

      {query.loading && !query.data ? (
        <PageLoader label="Loading rooms…" />
      ) : query.error ? (
        <div className="card p-6 text-center text-sm text-rose-600">{query.error}</div>
      ) : categories.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={LayoutGrid}
            title="No rooms yet"
            description="Create the first room and it will show up in navigation, search and the composer."
            action={
              canManage ? (
                <button type="button" className="btn-primary btn-sm" onClick={handleOpenCreate}>
                  <Plus className="h-3.5 w-3.5" /> Create a room
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => {
            const Icon = iconFor(category.icon);
            const path =
              category.kind === "MOVIE"
                ? "/cinema"
                : category.kind === "BOOK"
                  ? "/books"
                  : category.kind === "HIKE"
                    ? "/hiking"
                    : `/c/${category.slug}`;
            return (
              <div key={category.id} className="card flex items-start gap-3 p-4">
                <span
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${category.color}18`, color: category.color }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={path} className="truncate font-semibold text-ink hover:text-brand-700">
                    {category.name}
                  </Link>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted">{category.description}</p>
                  <p className="mt-1.5 text-[10px] text-muted/80">
                    /c/{category.slug} · {category.kind.toLowerCase()} · {category.postCount ?? 0} posts · order {category.sortOrder}
                  </p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-muted transition hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10"
                      onClick={() => handleOpenEdit(category)}
                      aria-label={`Edit ${category.name}`}
                      title="Edit Room"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-muted transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                      onClick={() => setDeleteTarget(category)}
                      aria-label={`Delete ${category.name}`}
                      title="Delete Room"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingCategory ? `Edit room: ${editingCategory.name}` : "Create a community room"}
        description={
          editingCategory
            ? "Update room name, description, appearance or order."
            : "Category pages, feeds and creation flows are generated from this configuration."
        }
        className="sm:max-w-xl"
      >
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="room-name" className="label">
              Name
            </label>
            <input
              id="room-name"
              className="input"
              value={form.name}
              onChange={(event) => {
                const name = event.target.value;
                setForm((current) => ({
                  ...current,
                  name,
                  slug: name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "")
                    .slice(0, 40),
                }));
              }}
              required
            />
          </div>
          <div>
            <label htmlFor="room-slug" className="label">
              Slug
            </label>
            <input
              id="room-slug"
              className="input"
              value={form.slug}
              onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
              pattern="[a-z0-9-]{2,40}"
              required
            />
          </div>
          <div>
            <label htmlFor="room-description" className="label">
              Description
            </label>
            <textarea
              id="room-description"
              className="input resize-y"
              rows={3}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              minLength={10}
              maxLength={500}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="room-icon" className="label">
                Icon
              </label>
              <select
                id="room-icon"
                className="input"
                value={form.icon}
                onChange={(event) => setForm((current) => ({ ...current, icon: event.target.value }))}
              >
                {ICONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="room-color" className="label">
                Colour
              </label>
              <input
                id="room-color"
                type="color"
                className="h-[42px] w-full rounded-xl border border-line bg-surface px-1"
                value={form.color}
                onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="room-kind" className="label">
                Type
              </label>
              <select
                id="room-kind"
                className="input"
                value={form.kind}
                onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value }))}
              >
                <option value="DISCUSSION">Discussion</option>
                <option value="MOVIE">Movie reviews</option>
                <option value="BOOK">Book reviews</option>
                <option value="HIKE">Hiking</option>
              </select>
            </div>
            <div>
              <label htmlFor="room-order" className="label">
                Sort order
              </label>
              <input
                id="room-order"
                type="number"
                min={0}
                max={999}
                className="input"
                value={form.sortOrder}
                onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setOpen(false);
                setEditingCategory(null);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingCategory ? (
                <Edit3 className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {editingCategory ? "Save changes" : "Create room"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "this room"}?`}
        description="Only empty rooms can be removed. Move or delete its posts first."
        busy={busy}
        onConfirm={remove}
      />
    </div>
  );
}
