"use client";

import { AlertTriangle, Download, FileUp, ListFilter, Plus, Search, SearchX, Sparkles, Trash2, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, ConfirmDialog, EmptyState, IconButton, Input, Menu, Select, Skeleton } from "@/components/ui";
import type { ApiFilters } from "@/lib/contacts";
import { pluralize } from "@/lib/format";
import {
  contactsApi,
  useAutoAddFromForms,
  useContactLists,
  useContacts,
  useCreateList,
  useDeleteContacts,
  useDeleteList,
  useUpdateContact,
  useUpdateList,
  type Contact,
  type ContactList,
  type ContactsView,
} from "@/lib/queries/contacts";
import { ContactDrawer } from "./ContactDrawer";
import { ContactFormModal } from "./ContactFormModal";
import { ContactListsSidebar } from "./ContactListsSidebar";
import { ContactsTable, type EditableField } from "./ContactsTable";
import { FilterPanel } from "./FilterPanel";
import { ImportContactsModal } from "./ImportContactsModal";
import { ListNameModal } from "./ListNameModal";

const EVERYONE: ContactsView = { query: "", filters: null, listId: null, sort: "updated_at", order: "desc" };
const NO_SELECTION = new Set<number>();

/** Waits for typing to pause, so each keystroke in the search box isn't its own request. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

type Deleting = { ids: number[]; name: string | null } | null;

/** Typeform's Contacts tab: lists on the left, search / filter / add on top, an editable table, and a detail sidebar. */
export function ContactsPage() {
  const [searchText, setSearchText] = useState("");
  const query = useDebounced(searchText, 250);
  const [filters, setFilters] = useState<ApiFilters | null>(null);
  const [listId, setListId] = useState<number | null>(null);
  const [sort, setSort] = useState("updated_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const view = useMemo<ContactsView>(() => ({ query, filters, listId, sort, order }), [query, filters, listId, sort, order]);

  const contacts = useContacts(view);
  const everyone = useContacts(EVERYONE);
  const lists = useContactLists();
  const updateContact = useUpdateContact();
  const deleteContacts = useDeleteContacts();
  const autoAdd = useAutoAddFromForms();
  const createList = useCreateList();
  const updateList = useUpdateList();
  const deleteList = useDeleteList();

  const [picked, setPicked] = useState<Set<number>>(NO_SELECTION);
  const [openId, setOpenId] = useState<number | null>(null);
  const [formFor, setFormFor] = useState<Contact | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [deleting, setDeleting] = useState<Deleting>(null);
  const [savingFilters, setSavingFilters] = useState<ApiFilters | null>(null);
  const [renaming, setRenaming] = useState<ContactList | null>(null);
  const [deletingList, setDeletingList] = useState<ContactList | null>(null);

  const items = useMemo(() => contacts.data?.items ?? [], [contacts.data]);
  const total = contacts.data?.total ?? 0;
  // Only contacts still on screen count as selected (a search or edit may have removed some).
  const selected = useMemo(() => new Set(items.filter((c) => picked.has(c.id)).map((c) => c.id)), [items, picked]);
  const opened = items.find((c) => c.id === openId) ?? (everyone.data?.items.find((c) => c.id === openId) ?? null);
  const narrowed = Boolean(query.trim() || filters || listId !== null);
  const nobodyYet = everyone.data?.total === 0;

  // Close the filter panel when clicking elsewhere or pressing Escape.
  const filterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!filterOpen) return;
    const away = (e: MouseEvent) => !filterRef.current?.contains(e.target as Node) && setFilterOpen(false);
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setFilterOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [filterOpen]);

  function changeSort(key: string) {
    if (key === sort) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setOrder(key === "updated_at" ? "desc" : "asc");
    }
  }

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };
  const selectAll = () => setPicked(new Set(items.map((c) => c.id)));
  const toggleAll = () => (selected.size === items.length ? setPicked(NO_SELECTION) : selectAll());

  function clearAll() {
    setSearchText("");
    setFilters(null);
    setListId(null);
  }

  async function saveList(name: string) {
    if (!savingFilters) return;
    const list = await createList.mutateAsync({ name, filters: savingFilters });
    // The list now holds the filters, so show it instead of the unsaved filters.
    setFilters(null);
    setListId(list.id);
    setSavingFilters(null);
  }

  const addMenu = (
    <Menu
      items={[
        {
          label: "Auto-add from forms",
          description: "Add contacts from your form responses",
          icon: <Sparkles className="size-4 text-text-muted" />,
          onSelect: () => autoAdd.mutate(),
        },
        { label: "Add with import", description: "Import contacts from a CSV file", icon: <FileUp className="size-4 text-text-muted" />, onSelect: () => setImporting(true) },
        { label: "Add individually", description: "Enter one contact by hand", icon: <UserPlus className="size-4 text-text-muted" />, onSelect: () => setFormFor("new") },
      ]}
      trigger={(props) => (
        <Button {...props} leftIcon={<Plus className="size-4" />} loading={autoAdd.isPending}>
          Add contacts
        </Button>
      )}
    />
  );

  return (
    <>
      <ContactListsSidebar
        lists={lists.data ?? []}
        total={everyone.data?.total ?? null}
        activeId={listId}
        onSelect={(id) => {
          setListId(id);
          setPicked(NO_SELECTION);
        }}
        onNew={() => setFilterOpen(true)}
        onRename={setRenaming}
        onDelete={setDeletingList}
      />

      <section aria-label="Contacts" className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pt-6 md:px-8 md:pt-8">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
          <div>
            <h1 className="text-2xl font-normal text-text">
              {listId !== null ? (lists.data?.find((l) => l.id === listId)?.name ?? "Contacts") : "Contacts"}
            </h1>
            {contacts.data && <p className="mt-0.5 text-sm text-text-muted">{pluralize(total, "contact")}</p>}
          </div>
          {!nobodyYet && addMenu}
        </div>

        {!nobodyYet && (
          <>
            {/* Lists sit in the sidebar from md up; below that they're a dropdown. */}
            <div className="pb-3 md:hidden">
              <Select<string>
                aria-label="Contact list"
                options={[{ value: "all", label: "All contacts" }, ...(lists.data ?? []).map((l) => ({ value: String(l.id), label: l.name }))]}
                value={listId === null ? "all" : String(listId)}
                onChange={(value) => setListId(value === "all" ? null : Number(value))}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 pb-4">
              <div className="w-full max-w-xs">
                <Input
                  type="search"
                  aria-label="Search contacts"
                  placeholder="Search"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  leftIcon={<Search className="size-4" />}
                />
              </div>
              <div ref={filterRef} className="relative">
                <Button variant="secondary" leftIcon={<ListFilter className="size-4" />} aria-expanded={filterOpen} onClick={() => setFilterOpen((open) => !open)}>
                  Filter
                  {filters && <span className="ml-0.5 rounded-pill bg-primary px-1.5 text-xs text-primary-fg">{filters.conditions.length}</span>}
                </Button>
                {filterOpen && (
                  <FilterPanel
                    applied={filters}
                    onApply={(next) => {
                      setFilters(next);
                      setPicked(NO_SELECTION);
                    }}
                    onSaveAsList={(next) => {
                      setFilterOpen(false);
                      setSavingFilters(next);
                    }}
                    onClose={() => setFilterOpen(false)}
                  />
                )}
              </div>
              <a
                href={contactsApi.exportUrl(view)}
                download
                className="inline-flex h-9 items-center gap-2 rounded-input border border-border-strong bg-field px-4 text-sm font-medium whitespace-nowrap text-text-soft hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Download className="size-4" aria-hidden />
                Export CSV
              </a>
              {narrowed && (
                <button type="button" onClick={clearAll} className="text-sm font-medium text-accent hover:underline">
                  Clear search and filters
                </button>
              )}
            </div>
          </>
        )}

        {contacts.isPending || everyone.isPending ? (
          <div aria-busy="true" aria-label="Loading contacts" className="flex flex-col gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : contacts.isError ? (
          <EmptyState
            tone="danger"
            icon={<AlertTriangle className="size-6" />}
            title="Couldn't load your contacts"
            description={contacts.error.message}
            action={
              <Button variant="secondary" loading={contacts.isFetching} onClick={() => contacts.refetch()}>
                Try again
              </Button>
            }
          />
        ) : nobodyYet ? (
          <EmptyState
            icon={<Users className="size-6" />}
            title="Your contacts will appear here"
            description="Add the people you hear from. Get started with one of these:"
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button leftIcon={<Sparkles className="size-4" />} loading={autoAdd.isPending} onClick={() => autoAdd.mutate()}>
                  Auto-add from forms
                </Button>
                <Button variant="secondary" leftIcon={<FileUp className="size-4" />} onClick={() => setImporting(true)}>
                  Add with import
                </Button>
                <Button variant="secondary" leftIcon={<UserPlus className="size-4" />} onClick={() => setFormFor("new")}>
                  Add individually
                </Button>
              </div>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<SearchX className="size-6" />}
            title="No contacts match"
            description="Try a different search or change the filters."
            action={
              <Button variant="secondary" onClick={clearAll}>
                Clear search and filters
              </Button>
            }
          />
        ) : (
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-card border border-b-0 border-border bg-bg">
            <ContactsTable
              contacts={items}
              selected={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
              sort={sort}
              order={order}
              onSort={changeSort}
              onOpen={(c) => setOpenId(c.id)}
              onEdit={(contact: Contact, field: EditableField, value: string) => updateContact.mutate({ id: contact.id, data: { [field]: value } })}
            />
            {selected.size > 0 && (
              <div role="region" aria-label="Selected contacts" className="absolute inset-x-0 bottom-4 mx-auto flex w-max max-w-[calc(100%-2rem)] items-center gap-3 rounded-card bg-primary px-4 py-2 text-sm text-primary-fg shadow-lg">
                <span>{selected.size} selected</span>
                {selected.size < items.length && (
                  <button type="button" onClick={selectAll} className="font-medium underline underline-offset-2">
                    Select all {pluralize(items.length, "contact")}
                  </button>
                )}
                <IconButton
                  label="Delete selected contacts"
                  icon={<Trash2 className="size-4" />}
                  onClick={() => setDeleting({ ids: [...selected], name: null })}
                  className="text-primary-fg hover:bg-primary-hover hover:text-primary-fg"
                />
              </div>
            )}
          </div>
        )}
      </section>

      <ContactDrawer
        contact={opened}
        onClose={() => setOpenId(null)}
        onEdit={(contact) => setFormFor(contact)}
        onDelete={(contact) => setDeleting({ ids: [contact.id], name: contact.name || contact.email })}
      />
      <ContactFormModal open={formFor !== null} contact={formFor === "new" ? null : formFor} onClose={() => setFormFor(null)} />
      <ImportContactsModal open={importing} onClose={() => setImporting(false)} />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        destructive
        loading={deleteContacts.isPending}
        title={deleting?.ids.length === 1 ? "Delete this contact?" : "Delete contacts?"}
        message={
          deleting?.ids.length === 1
            ? `${deleting.name ?? "This contact"} will be permanently deleted from all your contact lists and from your contacts database.`
            : `${pluralize(deleting?.ids.length ?? 0, "contact")} will be permanently deleted from all your contact lists and from your contacts database.`
        }
        confirmLabel={deleting?.ids.length === 1 ? "Delete contact" : "Delete contacts"}
        cancelLabel={deleting?.ids.length === 1 ? "Keep contact" : "Cancel"}
        onConfirm={() => {
          if (!deleting) return;
          deleteContacts.mutate(deleting.ids, {
            onSuccess: () => {
              setPicked(NO_SELECTION);
              setOpenId(null);
            },
            onSettled: () => setDeleting(null),
          });
        }}
      />

      <ListNameModal open={savingFilters !== null} title="Save as new list" confirmLabel="Create list" onClose={() => setSavingFilters(null)} onSubmit={saveList} />
      <ListNameModal
        open={renaming !== null}
        title="Rename list"
        confirmLabel="Save"
        initialName={renaming?.name}
        onClose={() => setRenaming(null)}
        onSubmit={(name) => updateList.mutateAsync({ id: renaming!.id, name })}
      />
      <ConfirmDialog
        open={deletingList !== null}
        onClose={() => setDeletingList(null)}
        destructive
        title="Delete this list?"
        message={`“${deletingList?.name ?? ""}” will be deleted. The contacts in it stay in your database.`}
        confirmLabel="Delete list"
        onConfirm={() => {
          if (!deletingList) return;
          if (listId === deletingList.id) setListId(null);
          deleteList.mutate(deletingList.id);
          setDeletingList(null);
        }}
      />
    </>
  );
}
