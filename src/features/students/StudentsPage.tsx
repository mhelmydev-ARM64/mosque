import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "../../app/layouts/AppLayout";
import { useAuth } from "../auth/AuthContext";
import { useCommittees, useStudentsFor, useTemplate } from "../../services/hooks";
import { committeeBadgeProps } from "../../domain/colors";
import { normalizeArabic } from "../../domain/arabic";
import { studentMatchesFieldFilter } from "../../domain/template";
import { MEMO_LEVELS, memoLabel } from "../../domain/requests";
import { Loading, EmptyState } from "../../components/ui";

export default function StudentsPage() {
  const navigate = useNavigate();
  const { isSuperAdmin, committeePerm } = useAuth();
  const { committees, byId, loading: committeesLoading } = useCommittees();
  const { data: template } = useTemplate();

  const readable = useMemo(
    () =>
      committees
        .filter((c) => c.status === "active")
        .filter((c) => isSuperAdmin || committeePerm(c.id, "students.read")),
    [committees, isSuperAdmin, committeePerm]
  );

  const [committeeId, setCommitteeId] = useState<string | null>(null);
  const [archived, setArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"name" | "points">("name");
  const [memoFilter, setMemoFilter] = useState<string>("");
  const [minPoints, setMinPoints] = useState("");
  const [fieldFilters, setFieldFilters] = useState<Record<string, string>>({});

  const effectiveCommittee = committeeId ?? readable[0]?.id ?? null;
  const prefix = useMemo(() => {
    const t = search.trim();
    return t.length >= 2 ? normalizeArabic(t) : null;
  }, [search]);

  const { data: students, loading, error } = useStudentsFor(effectiveCommittee, archived, prefix, sort);

  const filtered = useMemo(() => {
    const min = minPoints.trim() === "" ? null : Number(minPoints);
    return students.filter((s) => {
      if (memoFilter && s.memorizationLevel !== memoFilter) return false;
      if (min !== null && !Number.isNaN(min) && s.points < min) return false;
      for (const [key, wanted] of Object.entries(fieldFilters)) {
        if (wanted && !studentMatchesFieldFilter(s, key, wanted)) return false;
      }
      return true;
    });
  }, [students, memoFilter, minPoints, fieldFilters]);

  const filterableFields = (template?.fields ?? []).filter(
    (f) => f.type === "select" || f.type === "boolean" || f.type === "multiselect"
  );

  const canCreate = effectiveCommittee ? (isSuperAdmin || committeePerm(effectiveCommittee, "students.create")) : false;

  if (committeesLoading) {
    return (
      <AppLayout title="الطلاب">
        <Loading />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="الطلاب">
      <div className="row mb-1">
        <input
          className="input flex1"
          placeholder="بحث بالاسم..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          type="search"
        />
        <select className="select" style={{ width: "auto" }} value={sort} onChange={(e) => setSort(e.target.value as "name" | "points")}>
          <option value="name">الاسم</option>
          <option value="points">النقاط</option>
        </select>
        {canCreate ? (
          <Link to="/students/new" className="btn btn--primary btn--sm">
            + طالب
          </Link>
        ) : null}
      </div>

      {readable.length === 0 ? (
        <EmptyState icon="🔒" title="لا توجد لجان متاحة" sub="تحتاج صلاحية قراءة الطلاب في لجنة واحدة على الأقل" />
      ) : (
        <>
          <div className="row mb-1">
            {readable.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip ${effectiveCommittee === c.id ? "chip--on" : ""}`}
                data-cc={effectiveCommittee === c.id ? c.colorKey : undefined}
                onClick={() => setCommitteeId(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="row mb-1 small">
            <select className="select" style={{ width: "auto" }} value={memoFilter} onChange={(e) => setMemoFilter(e.target.value)}>
              <option value="">كل المستويات</option>
              {MEMO_LEVELS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
            <input
              className="input"
              style={{ width: 110 }}
              type="number"
              placeholder="أدنى نقاط"
              value={minPoints}
              onChange={(e) => setMinPoints(e.target.value)}
            />
            <label className="check-row">
              <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
              المؤرشفون
            </label>
          </div>

          {filterableFields.length > 0 ? (
            <details className="card small">
              <summary className="bold">فلاتر الحقول الديناميكية</summary>
              <div className="grid-2 mt-1">
                {filterableFields.map((f) => (
                  <div key={f.key} className="field mb-0">
                    <span className="label">{f.label}</span>
                    {f.type === "boolean" ? (
                      <select
                        className="select"
                        value={fieldFilters[f.key] ?? ""}
                        onChange={(e) => setFieldFilters((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      >
                        <option value="">الكل</option>
                        <option value="true">نعم</option>
                        <option value="false">لا</option>
                      </select>
                    ) : f.options ? (
                      <select
                        className="select"
                        value={fieldFilters[f.key] ?? ""}
                        onChange={(e) => setFieldFilters((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      >
                        <option value="">الكل</option>
                        {f.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="input"
                        value={fieldFilters[f.key] ?? ""}
                        onChange={(e) => setFieldFilters((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            </details>
          ) : null}

          {error ? <p className="error-text">{error}</p> : null}
          {loading ? (
            <Loading />
          ) : filtered.length === 0 ? (
            <EmptyState icon="🎓" title="لا يوجد طلاب" sub="جرّب تغيير الفلاتر أو أضف طالبًا جديدًا" />
          ) : (
            <div className="list">
              {filtered.map((s) => {
                const c = byId.get(s.committeeId);
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="list-row"
                    style={{ cursor: "pointer", width: "100%", textAlign: "start", color: "inherit", background: "var(--surface)" }}
                    onClick={() => navigate(`/students/${s.id}`)}
                  >
                    <div className="list-row__main">
                      <div className="list-row__title">{s.name}</div>
                      <div className="list-row__sub">
                        {s.points} نقطة · {memoLabel(s.memorizationLevel)}
                      </div>
                    </div>
                    {c ? <span {...committeeBadgeProps(c.colorKey)}>{c.name}</span> : null}
                  </button>
                );
              })}
            </div>
          )}
          {prefix && filtered.length === 0 && students.length === 0 ? (
            <p className="tiny faint" style={{ textAlign: "center" }}>
              البحث يطابق بداية الاسم بعد إزالة التشكيل وتوحيد الهمزات
            </p>
          ) : null}
        </>
      )}
    </AppLayout>
  );
}
