import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import {
  getTravelLibraryCategoryLabel,
  travelLibraryCategories,
  travelLibraryItems,
  type TravelLibraryCategory,
  type TravelLibraryItem,
} from "@/lib/travel-library";

function normalize(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function itemMatchesSearch(item: TravelLibraryItem, searchTerm: string) {
  if (!searchTerm) return true;

  const haystack = [
    item.title,
    item.summary,
    item.category,
    ...item.answer,
    ...item.tags,
    item.sourceLabel,
    ...(item.askAdvisorWhen ?? []),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(searchTerm);
}

function SearchBox({
  defaultValue,
  activeCategory,
}: {
  defaultValue: string;
  activeCategory: string;
}) {
  return (
    <form
      action="/travel-library"
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      {activeCategory !== "all" ? (
        <input type="hidden" name="category" value={activeCategory} />
      ) : null}
      <input
        className="input"
        name="q"
        type="search"
        placeholder="Search advisor, cancellations, passports, packing..."
        defaultValue={defaultValue}
        style={{ flex: "1 1 320px", minWidth: 240 }}
      />
      <button className="btn btn-primary" type="submit">
        Search
      </button>
      {defaultValue || activeCategory !== "all" ? (
        <Link href="/travel-library" className="btn btn-outline">
          Clear
        </Link>
      ) : null}
    </form>
  );
}

function CategoryPills({
  activeCategory,
  searchTerm,
}: {
  activeCategory: string;
  searchTerm: string;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {travelLibraryCategories.map((category) => {
        const isActive = category.id === activeCategory;
        const href =
          category.id === "all"
            ? searchTerm
              ? `/travel-library?q=${encodeURIComponent(searchTerm)}`
              : "/travel-library"
            : `/travel-library?category=${category.id}${searchTerm ? `&q=${encodeURIComponent(searchTerm)}` : ""}`;

        return (
          <Link
            key={category.id}
            href={href}
            style={{
              borderRadius: 999,
              border: `1px solid ${isActive ? "var(--accent-dark)" : "var(--border)"}`,
              background: isActive ? "var(--accent-dark)" : "#ffffff",
              color: isActive ? "#ffffff" : "var(--accent-dark)",
              padding: "8px 12px",
              fontSize: 13,
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            {category.label}
          </Link>
        );
      })}
    </div>
  );
}

function LibraryItemCard({ item }: { item: TravelLibraryItem }) {
  return (
    <article
      className="card stack"
      style={{
        borderRadius: 8,
        border: "1px solid #dbeafe",
        gap: 12,
      }}
    >
      <div>
        <p
          style={{
            margin: 0,
            color: "var(--accent-dark)",
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {getTravelLibraryCategoryLabel(item.category)}
        </p>
        <h2 style={{ margin: "5px 0 0", fontSize: "1.25rem" }}>
          {item.title}
        </h2>
        <p style={{ margin: "8px 0 0", color: "#5e7e8f", lineHeight: 1.55 }}>
          {item.summary}
        </p>
      </div>

      <details>
        <summary
          style={{
            cursor: "pointer",
            color: "var(--accent-dark)",
            fontWeight: 900,
            listStyle: "none",
          }}
        >
          Read Answer
        </summary>
        <div className="stack-sm" style={{ marginTop: 12 }}>
          {item.answer.map((paragraph) => (
            <p key={paragraph} style={{ margin: 0, color: "#344054", lineHeight: 1.65 }}>
              {paragraph}
            </p>
          ))}
        </div>
      </details>

      {item.askAdvisorWhen?.length ? (
        <div
          style={{
            borderTop: "1px solid #e6f0f2",
            paddingTop: 12,
          }}
        >
          <p style={{ margin: 0, fontWeight: 900, color: "var(--accent-dark)" }}>
            Ask your advisor when:
          </p>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#5e7e8f", lineHeight: 1.55 }}>
            {item.askAdvisorWhen.map((prompt) => (
              <li key={prompt}>{prompt}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {item.pdfUrl ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a
            href={item.pdfUrl}
            className="btn btn-primary"
            target="_blank"
            rel="noreferrer"
            style={{ padding: "9px 14px", fontSize: 13 }}
          >
            {item.pdfLabel ?? "Download PDF"}
          </a>
        </div>
      ) : null}

      {item.sourceUrl ? (
        <div>
          <a
            href={item.sourceUrl}
            className="btn btn-outline"
            target="_blank"
            rel="noreferrer"
            style={{ padding: "9px 14px", fontSize: 13 }}
          >
            {item.sourceLabel ?? "Official Resource"}
          </a>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {item.tags.map((tag) => (
          <span
            key={tag}
            style={{
              borderRadius: 999,
              background: "#f0f7f8",
              color: "var(--accent-dark)",
              padding: "5px 9px",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
}

export default async function TravelLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;
  const searchTerm = normalize(q);
  const validCategories = new Set<string>(
    travelLibraryCategories.map((item) => item.id),
  );
  const activeCategory = validCategories.has(category ?? "")
    ? String(category)
    : "all";

  const rows = travelLibraryItems.filter((item) => {
    const matchesCategory =
      activeCategory === "all" ||
      item.category === (activeCategory as TravelLibraryCategory);

    return matchesCategory && itemMatchesSearch(item, searchTerm);
  });

  const activeCategoryDetails =
    travelLibraryCategories.find((item) => item.id === activeCategory) ??
    travelLibraryCategories[0];

  return (
    <PageShell
      title="Travel Tips & FAQ"
      subtitle="Personal planning, proactive care, and practical answers to help you feel prepared before departure."
    >
      <section
        className="card stack"
        style={{
          border: "1px solid #bfdbfe",
          background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 72%)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ maxWidth: 720 }}>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--accent-dark)",
                fontWeight: 900,
              }}
            >
              Client Library
            </p>
            <h2 style={{ margin: "6px 0 0" }}>
              Quick answers with personal support close by.
            </h2>
            <p style={{ margin: "8px 0 0", color: "#5e7e8f", lineHeight: 1.6 }}>
              Use this library for general travel guidance and official resources. When the answer depends on your exact booking, supplier rules, or travel dates, message Jeremy for personal guidance.
            </p>
          </div>
          <Link href="/messages" className="btn btn-primary">
            Ask Jeremy
          </Link>
        </div>

        <SearchBox defaultValue={q ?? ""} activeCategory={activeCategory} />
        <CategoryPills activeCategory={activeCategory} searchTerm={q ?? ""} />
      </section>

      <section className="stack">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--accent-dark)",
                fontWeight: 900,
              }}
            >
              {activeCategoryDetails.label}
            </p>
            <h2 style={{ margin: "4px 0 0" }}>
              {rows.length} result{rows.length === 1 ? "" : "s"}
            </h2>
            <p style={{ margin: "6px 0 0", color: "#5e7e8f" }}>
              {activeCategoryDetails.description}
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="card" style={{ borderRadius: 8 }}>
            <p style={{ margin: 0, color: "#5e7e8f", lineHeight: 1.6 }}>
              No tips found. Try clearing the search or choosing another category.
            </p>
          </div>
        ) : (
          <div className="grid grid-2">
            {rows.map((item) => (
              <LibraryItemCard key={item.slug} item={item} />
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
