import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useAllStudents, useCommittees } from "../../services/hooks";
import { committeeBadgeProps } from "../../domain/colors";
import { normalizeArabic } from "../../domain/arabic";
import { memoLabel } from "../../domain/requests";
import { formatNumber } from "../../lib/format";
import { EmptyState, Loading, Select } from "../../components/ui";
import { IconCap, IconLock, IconSearch, IconX } from "../../components/icons";

/** أحرف الفهرس بعد التوحيد الذي تقوم به normalizeArabic. */
const ALPHABET = "ا ب ت ه ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن و ي".split(" ");

export default function StudentDirectoryPage() {
  const { isSuperAdmin, hasGlobal } = useAuth();
  const { byId } = useCommittees();

  const [search, setSearch] = useState("");
  const [letter, setLetter] = useState("");
  const [committeeId, setCommitteeId] = useState("");
  const [sort, setSort] = useState<"name" | "points">("name");
  const [archived, setArchived] = useState(false);

  const prefix = useMemo(() => {
    const typed = normalizeArabic(search);
    if (typed.length >= 2) return typed;
    return letter ? normalizeArabic(letter) : null;
  }, [search, letter]);

  const { data: students, loading, error } = useAllStudents(archived, prefix, sort);

  const visible = useMemo(
    () => (committeeId ? students.filter((s) => s.committeeId === committeeId) : students),
    [students, committeeId]
  );

  const committeeCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of students) map.set(s.committeeId, (map.get(s.committeeId) ?? 0) + 1);
    return map;
  }, [students]);

  const totalPoints = useMemo(() => visible.reduce((sum, s) => sum + (s.points ?? 0), 0), [visible]);

  if (!isSuperAdmin && !hasGlobal("students.oversight")) {
    return (
      <EmptyState
        icon={<IconLock size={30} />}
        title="لا تملك صلاحية الدليل العام"
        sub="هذا القسم لمن يملك صلاحية «الاطلاع على كل الطلاب». استخدم صفحة الطلاب للجانك."
      />
    );
  }

  return (
    <div className="stack">
      <div className="row">
        <h2 className="page-title flex1">دليل الطلاب</h2>
        <span className="badge badge--primary">
          <IconCap size={13} />
          {formatNumber(visible.length)}
        </span>
      </div>

      <div className="toolbar">
        <div className="search-field flex1">
          <IconSearch size={16} />
          <input
            className="search-field__input"
            type="search"
            placeholder="ابحث بالاسم (حرفان على الأقل)..."
            aria-label="بحث بالاسم"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLetter("");
            }}
          />
          {search ? (
            <button
              type="button"
              className="search-field__clear"
              aria-label="مسح البحث"
              onClick={() => setSearch("")}
            >
              <IconX size={14} />
            </button>
          ) : null}
        </div>
        <Select
          size="sm"
          value={sort}
          onChange={(v) => setSort(v as "name" | "points")}
          options={[
            { value: "name", label: "ترتيب: الاسم" },
            { value: "points", label: "ترتيب: النقاط" },
          ]}
        />
        <label className="check-row">
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
          المؤرشفون
        </label>
      </div>

      <div className="alpha-strip">
        <button type="button" className={letter === "" && !search ? "is-on" : ""} onClick={() => setLetter("")}>
          الكل
        </button>
        {ALPHABET.map((a) => (
          <button
            key={a}
            type="button"
            className={letter === a ? "is-on" : ""}
            onClick={() => {
              setLetter(letter === a ? "" : a);
              setSearch("");
            }}
          >
            {a}
          </button>
        ))}
      </div>

      {committeeCounts.size > 1 ? (
        <div className="chips">
          <button type="button" className={`chip ${committeeId === "" ? "chip--on" : ""}`} onClick={() => setCommitteeId("")}>
            كل اللجان ({formatNumber(students.length)})
          </button>
          {[...committeeCounts.entries()]
            .sort((a, b) => (byId.get(a[0])?.name ?? "").localeCompare(byId.get(b[0])?.name ?? "", "ar"))
            .map(([cid, count]) => {
              const c = byId.get(cid);
              return (
                <button
                  key={cid}
                  type="button"
                  className={`chip ${committeeId === cid ? "chip--on" : ""}`}
                  data-cc={committeeId === cid ? c?.colorKey : undefined}
                  onClick={() => setCommitteeId(committeeId === cid ? "" : cid)}
                >
                  {c?.name ?? cid} ({count})
                </button>
              );
            })}
        </div>
      ) : null}

      <div className="stat-grid">
        <div className="stat">
          <span className="stat__label">طلاب معروضون</span>
          <span className="stat__value">{formatNumber(visible.length)}</span>
        </div>
        <div className="stat">
          <span className="stat__label">لجان ممثَّلة</span>
          <span className="stat__value">{formatNumber(committeeCounts.size)}</span>
        </div>
        <div className="stat">
          <span className="stat__label">مجموع النقاط</span>
          <span className="stat__value">{formatNumber(totalPoints)}</span>
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <Loading /> : null}

      {!loading && visible.length === 0 ? (
        <EmptyState
          icon={<IconCap size={30} />}
          title="لا نتائج"
          sub="جرّب حرفًا آخر أو أزل فلترة اللجنة، وتأكد من حالة الأرشفة."
        />
      ) : null}

      {!loading && visible.length > 0 ? (
        <div className="dir-grid">
          {visible.map((s) => {
            const c = byId.get(s.committeeId);
            return (
              <Link key={s.id} to={`/students/${s.id}`} className="card dir-card" data-cc={c?.colorKey}>
                <div className="dir-card__name">{s.name}</div>
                <div className="dir-card__meta">
                  <span className="badge badge--primary">{formatNumber(s.points)} نقطة</span>
                  <span className="badge">{memoLabel(s.memorizationLevel)}</span>
                  {c ? <span {...committeeBadgeProps(c.colorKey)}>{c.name}</span> : null}
                </div>
              </Link>
            );
          })}
        </div>
      ) : null}

      <p className="tiny faint">
        البحث يعمل على بداية الاسم بعد إزالة التشكيل وتوحيد الهمزات. اضغط بطاقة الطالب لفتح ملفه.
      </p>
    </div>
  );
}
